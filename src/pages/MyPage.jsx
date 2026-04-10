import React, { useState, useEffect } from 'react';
// 🔥 [수정됨] 알림 로그를 남기기 위해 addDoc, serverTimestamp 추가
import { collection, doc, onSnapshot, query, where, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; 
import QRCodeGen from '../components/QRCodeGen';

const MyPage = ({ user, setViewMode }) => {
  const [userData, setUserData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [myReservations, setMyReservations] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (!user.uid && !user.studentNo)) return;
    const currentUserId = user.uid || user.studentNo;
    const myUserId = user?.email || user?.studentNo; 

    const userRef = doc(db, 'User', currentUserId);
    const unsubUser = onSnapshot(userRef, (userSnap) => {
      if (userSnap.exists()) setUserData(userSnap.data());
    });

    const logsRef = collection(db, 'Log'); 
    const unsubLogs = onSnapshot(logsRef, (logSnap) => {
      const logList = logSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(log => 
          log.uid === user?.uid || log.uid === user?.email ||       
          log.studentNo === user?.studentNo || log.studentNo === user?.name      
        )
        .sort((a, b) => {
          const timeA = (a.timestamp || a.createdAt)?.toDate ? (a.timestamp || a.createdAt).toDate() : new Date(0);
          const timeB = (b.timestamp || b.createdAt)?.toDate ? (b.timestamp || b.createdAt).toDate() : new Date(0);
          return timeB - timeA;
        });
      setLogs(logList);
    });

    const seatsRef = collection(db, 'Seat');
    const qSeat = query(seatsRef, where("userId", "==", myUserId));
    const unsubSeat = onSnapshot(qSeat, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const seatData = change.doc.data();
          if (seatData.status === "OCCUPIED") {
            alert('✅ QR 인증 완료!\n자리 사용을 시작합니다.');
            if (setViewMode) setViewMode('MAP');
          }
        }
      });
    });

    const resRef = collection(db, 'Reservations');
    const qRes = query(resRef, where("userId", "==", myUserId));
    const unsubRes = onSnapshot(qRes, (snap) => {
      const resList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyReservations(resList);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubLogs();
      unsubSeat(); 
      unsubRes();
    };
  }, [user, setViewMode]);

  // 🔥 [핵심 수정!] 예약 취소 시 로그 남기기
  const handleCancelReservation = async (res) => {
    if (window.confirm("정말 이 예약을 취소하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "Reservations", res.id));
        
        // 🔔 취소했다는 알림 데이터를 Log 컬렉션에 쏩니다!
        await addDoc(collection(db, "Log"), {
          action: 'CANCEL',
          seatId: res.seatId,
          seatLabel: res.seatId,
          uid: user.email,
          result: '유저 직접 취소',
          createdAt: serverTimestamp()
        });

        alert("✅ 예약이 성공적으로 취소되었습니다.");
      } catch (error) {
        alert("🚨 취소 중 오류가 발생했습니다.");
      }
    }
  };

  const handleModifyReservation = async (res) => {
    if (window.confirm("예약을 변경하시려면 현재 예약을 취소하고 다시 예약해야 합니다.\n기존 예약을 취소하고 배치도로 이동하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "Reservations", res.id));
        if (setViewMode) setViewMode('MAP');
      } catch (error) {
        alert("🚨 취소 후 이동 중 오류가 발생했습니다.");
      }
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px', fontWeight: 'bold', color: '#64748b' }}>데이터를 불러오는 중입니다... ⏳</div>;

  return (
    <div style={{ padding: window.innerWidth < 600 ? '10px' : '30px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#0f172a', fontWeight: '700', margin: 0 }}>마이페이지</h1>
      </div>

      <QRCodeGen studentId={user?.studentNo || user?.email?.split('@')[0] || "학번없음"} />

      <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>나의 패널티 현황</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '15px', textAlign: 'center', minWidth: '200px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>현재 노쇼 누적</p>
            <p style={{ margin: '10px 0 0 0', fontSize: '2rem',  fontWeight: '900', color: userData?.penaltyCount >= 2 ? '#dc2626' : '#2563eb' }}>
              {userData?.penaltyCount || 0} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 3회</span>
            </p>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '15px', textAlign: 'center', minWidth: '200px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>예약 정지 해제일</p>
            <p style={{ margin: '10px 0 0 0', fontSize: '1.1rem', fontWeight: '900', color: userData?.penaltyUntil ? '#dc2626' : '#16a34a' }}>
              {userData?.penaltyUntil 
                ? new Date(userData.penaltyUntil.toDate()).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : '정지 내역 없음'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>📅 나의 예약 현황</h2>
        
        {myReservations.length === 0 ? (
          <div style={{ textAlign: 'center', background: '#f8fafc', padding: '40px 20px', borderRadius: '16px', color: '#64748b' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>🪑</span>
            <p style={{ fontWeight: '700', margin: 0 }}>현재 예약된 좌석이 없습니다.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {myReservations.map((res) => (
              <div key={res.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '2px solid #e2e8f0', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div>
                  <span style={{ background: '#fef08a', color: '#ca8a04', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '900', display: 'inline-block', marginBottom: '10px' }}>예약 확정</span>
                  <h4 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: '900' }}>{res.seatId} 좌석</h4>
                  <p style={{ margin: '8px 0 0 0', color: '#475569', fontWeight: '700', fontSize: '0.95rem' }}>
                    📅 {res.date} <span style={{ margin: '0 5px', color: '#cbd5e1' }}>|</span> ⏰ {res.startTime} ~ {res.endTime}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button onClick={() => handleModifyReservation(res)} style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>변경</button>
                  <button onClick={() => handleCancelReservation(res)} style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>예약 취소</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>최근 이용 이력</h2>
        
        {(() => {
          const dailyData = {};
          
          logs
            .filter(log => log.action === 'RETURN' || log.action === 'AUTO_CHECKOUT')
            .forEach((log) => {
              const logDate = (log.timestamp || log.createdAt)?.toDate ? (log.timestamp || log.createdAt).toDate() : new Date();
              const year = logDate.getFullYear();
              const month = logDate.getMonth() + 1;
              const date = logDate.getDate();
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const day = dayNames[logDate.getDay()];
              const dateString = `${year}년 ${month}월 ${date}일 ${day}요일`;
              
              let actualMinutes = log.usedMinutes || 0;
              if (actualMinutes < 0) actualMinutes = 0;

              if (!dailyData[dateString]) {
                dailyData[dateString] = { totalMinutes: 0, sortKey: logDate.getTime() };
              }
              dailyData[dateString].totalMinutes += actualMinutes;
            });

          const groupedLogs = Object.entries(dailyData)
            .sort(([, a], [, b]) => b.sortKey - a.sortKey)
            .map(([dateString, data]) => ({ dateString, totalMinutes: data.totalMinutes }));

          if (groupedLogs.length === 0) {
            return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontWeight: 'bold' }}>아직 도서관 이용 기록이 없습니다.</p>;
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '500px', overflowY: 'auto' }}>
              {groupedLogs.map((item, index) => {
                const h = Math.floor(item.totalMinutes / 60); 
                const m = item.totalMinutes % 60;             

                let durationText = '';
                if (h > 0) durationText += `${h}시간 `;
                if (m > 0) durationText += `${m}분`;
                durationText = durationText.trim() || '1분 미만'; 

                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: '#f8fafc', borderRadius: '15px', marginBottom: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b' }}>{item.dateString}</div>
                    <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px 16px', borderRadius: '20px', fontWeight: '900', fontSize: '0.95rem' }}>{durationText} 이용</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default MyPage;