import { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment, collection } from 'firebase/firestore'; 

import MyPage from './pages/MyPage';
import ScannerPage from './pages/Scanner';
import SeatModal from './components/SeatModal';
import Auth from './pages/Auth';
import FloorMap from './components/FloorMap';
import AdminDashboard from './pages/AdminDashboard';

import { useLibraryData } from './hooks/useLibraryData';
import { useUserSession } from './hooks/useUserSession';
import { useLibrarySystem } from './hooks/useLibrarySystem';
import { handleLibraryAction, calculateElapsedTime } from './api/libraryService';

// 🔔 알림 텍스트 헬퍼 함수
const getNotificationText = (action, seatLabel) => {
  const label = seatLabel || '좌석';
  switch (action) {
    case 'RESERVE': return `✅ ${label} 예약이 완료되었습니다.`;
    case 'CANCEL': return `🗑️ ${label} 예약이 취소되었습니다.`;
    case 'NO_SHOW_CANCEL': return `🚨 ${label} 미입실로 예약이 취소되었습니다.`;
    case 'CHECK_IN': return `📲 ${label} 입실이 확인되었습니다.`;
    case 'RETURN': return `👋 ${label} 퇴실 처리되었습니다.`;
    case 'AUTO_CHECKOUT': return `⏳ ${label} 이용 시간이 만료되어 자동 퇴실되었습니다.`;
    case 'FORCE_EVICT': return `❌ ${label} 관리자에 의해 강제 퇴실되었습니다.`;
    default: return `🔔 ${label}에 새로운 변경사항이 있습니다.`;
  }
};

function App() {
  const { seats, user, currentUserData } = useLibraryData();

  const ADMIN_IDS = ['pjy', 'admin', 'manager', '1111111', '관리자']; 
  const isAdmin = user && user.email && ADMIN_IDS.includes(user.email.split('@')[0]);

  const [activeFloor, setActiveFloor] = useState('1층');
  const [viewMode, setViewMode] = useState('MAP');
  
  const [showSeatQR, setShowSeatQR] = useState(false);
  const [qrString, setQrString] = useState("");
  const [timeLeft, setTimeLeft] = useState(15);
  const [reserveHours, setReserveHours] = useState(1);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [reminderMinutes, setReminderMinutes] = useState(20); 
  const [reservationStep, setReservationStep] = useState(1);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [cancelWarningData, setCancelWarningData] = useState(null); 

  const [examStartDate, setExamStartDate] = useState('');
  const [examEndDate, setExamEndDate] = useState('');
  const [isExamActive, setIsExamActive] = useState(false);

  // 🔔 알림 시스템 상태 관리
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastReadTime, setLastReadTime] = useState(() => {
    return parseInt(localStorage.getItem(`lastRead_${user?.email}`) || '0', 10);
  });

  useUserSession(user);

  // 🔥 [핵심 수정 1] 내 활동 로그(알림) 마이페이지와 동일한 무적 로직으로 변경!
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'Log'), (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        // 내 이메일, UID, 학번, 이름 중 하나라도 겹치면 다 가져옴!
        .filter(log => 
          log.uid === user?.uid || log.uid === user?.email ||       
          log.studentNo === user?.studentNo || log.studentNo === user?.name      
        )
        // timestamp와 createdAt을 모두 호환해서 정렬!
        .sort((a, b) => {
          const timeA = (a.timestamp || a.createdAt)?.toDate ? (a.timestamp || a.createdAt).toDate().getTime() : 0;
          const timeB = (b.timestamp || b.createdAt)?.toDate ? (b.timestamp || b.createdAt).toDate().getTime() : 0;
          return timeB - timeA;
        });
      setNotifications(logs);
    });
    return () => unsub();
  }, [user]);

  // 🔥 [핵심 수정 2] 안 읽은 알림 개수 세는 로직도 timestamp/createdAt 완벽 호환!
  const unreadCount = notifications.filter(n => {
    const time = (n.timestamp || n.createdAt)?.toDate ? (n.timestamp || n.createdAt).toDate().getTime() : 0;
    return time > lastReadTime;
  }).length;

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      const now = Date.now();
      setLastReadTime(now);
      localStorage.setItem(`lastRead_${user?.email}`, now.toString());
    }
  };

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "System", "config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExamStartDate(data.examStartDate || '');
        setExamEndDate(data.examEndDate || '');
        setIsExamActive(data.isExamActive || false);
      }
    });
    return () => unsubConfig();
  }, []);  

  const now = useLibrarySystem(
    seats, user, isAdmin, isExamActive, examEndDate,
    setExamStartDate, setExamEndDate, setIsExamActive
  );

  const currentTime = new Date();
  const isExamPeriod = Boolean(
    isExamActive && examStartDate && examEndDate && 
    currentTime >= new Date(examStartDate) && currentTime <= new Date(examEndDate)
  );

  const hasReserved = seats.some(seat => seat.userId === user?.email);

  useEffect(() => {
    if (selectedSeat) {
      const liveSeat = seats.find(s => s.id === selectedSeat.id);
      if (liveSeat && liveSeat.status !== selectedSeat.status) {
        setSelectedSeat(liveSeat);
      }
    }
  }, [seats, selectedSeat]);

  useEffect(() => {
    let timer;
    if (showSeatQR && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setShowSeatQR(false);
      alert("⌛ 보안을 위해 QR 코드가 만료되었습니다. 다시 눌러주세요.");
    }
    return () => clearInterval(timer);
  }, [showSeatQR, timeLeft]);

  const saveExamPeriod = async () => {
    if (!examStartDate || !examEndDate) return alert("날짜와 시간을 입력해주세요.");
    await setDoc(doc(db, "System", "config"), { examStartDate, examEndDate, isExamActive: true }, { merge: true });
    setIsExamActive(true); 
    alert("✅ 시험 기간 정책이 활성화되었습니다.");
  };

  const clearExamPeriod = async () => {
    if (window.confirm("설정된 시험 기간 일정을 해제하시겠습니까?")) {
      await setDoc(doc(db, "System", "config"), { examStartDate: '', examEndDate: '', isExamActive: false }, { merge: true });
      setExamStartDate(''); setExamEndDate(''); setIsExamActive(false);
      alert("✅ 일반 모드로 전환되었습니다.");
    }
  };

  const handleCancelClick = async () => {
    if (isAdmin) {
      if (window.confirm("관리자 권한으로 예약을 취소하시겠습니까?\n(패널티가 부여되지 않습니다.)")) {
        handleLibraryAction({
          actionType: 'CANCEL', seat: selectedSeat, user, isAdmin, isExamPeriod, now, 
          reminderMinutes, setSelectedSeat, setShowCancelWarning, setCancelWarningData
        });
      }
      return; 
    }

    const targetStudentNo = selectedSeat.userId.split('@')[0];
    const targetUserSnap = await getDoc(doc(db, "User", targetStudentNo));
    if (targetUserSnap.exists()) {
      setCancelWarningData(targetUserSnap.data());
    } else {
      setCancelWarningData({ cancelCount: 0, penaltyCount: 0 });
    }
    setShowCancelWarning(true);
  };

  if (!user) {
    return <Auth isExamPeriod={isExamPeriod} />;
  }

  const floorTitles = { '1층': '1층 열람실', '2층': '2층 집중구역', '4층': '4층 스터디룸' };

  return (
    <div style={{ padding: window.innerWidth < 600 ? '10px' : '30px 20px', width: '100%', maxWidth: window.innerWidth < 600 ? '100%' : '1300px', margin: '0 auto', boxSizing: 'border-box', fontFamily: 'sans-serif', background: '#e2e8f0', minHeight: '100vh' }}>

      <header style={{ display: 'flex', flexDirection: window.innerWidth < 850 ? 'column' : 'row', marginBottom: '20px', background: '#fff', padding: window.innerWidth < 850 ? '30px 20px' : '30px 40px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', alignItems: 'center', gap: window.innerWidth < 850 ? '15px' : '0' }}>
        <div style={{ flex: window.innerWidth < 850 ? 'none' : 1, display: 'flex', justifyContent: window.innerWidth < 850 ? 'center' : 'flex-start' }}>
          <h2 style={{ margin: 0, padding: 0, lineHeight: 1, color: '#0f172a', fontWeight: '900', fontSize: window.innerWidth < 600 ? '1.5rem' : '1.8rem', marginLeft: window.innerWidth < 850 ? '0' : '60px' }}>
            📚 스마트 도서관
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: window.innerWidth < 850 ? 'center' : 'flex-end', width: window.innerWidth < 850 ? '100%' : 'auto', flex: window.innerWidth < 850 ? 'none' : 1, gap: isAdmin ? '15px' : '0', boxSizing: 'border-box' }}>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '15px', padding: '5px', width: window.innerWidth < 850 ? '100%' : '420px', maxWidth: '100%' }}>
                <button onClick={() => setViewMode('MAP')} style={{ flex: 1, padding: '12px', background: viewMode === 'MAP' ? '#2563eb' : 'transparent', color: viewMode === 'MAP' ? '#fff' : '#475569', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '0.95rem' }}>배치도</button>
                <button onClick={() => setViewMode('USERS')} style={{ flex: 1, padding: '12px', background: viewMode === 'USERS' ? '#2563eb' : 'transparent', color: viewMode === 'USERS' ? '#fff' : '#475569', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '0.95rem' }}>회원관리</button>
                <button onClick={() => setViewMode('SCANNER')} style={{ flex: 1, padding: '12px', background: viewMode === 'SCANNER' ? '#2563eb' : 'transparent', color: viewMode === 'SCANNER' ? '#fff' : '#475569', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '0.95rem' }}>입구 스캐너</button>
              </div>
            </div>
          )}
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: window.innerWidth < 850 ? 'center' : 'flex-end', gap: '15px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <p style={{ margin: 0, padding: 0, lineHeight: 1, fontWeight: '900', color: '#475569', fontSize: '0.95rem' }}>
                👤 {user?.email?.split('@')[0]}님 {isAdmin && <span style={{ color: '#b45309' }}>[관리자]</span>}
              </p>
              
              {/* ✨ 세련된 SVG 알림 버튼 */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={toggleNotifications}
                  style={{ background: '#f1f5f9', border: 'none', width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#475569" style={{ width: '22px', height: '22px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>

                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: '900', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div style={{ position: 'absolute', top: '55px', right: '0', width: '320px', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 1000, overflow: 'hidden' }}>
                    <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: '900' }}>새로운 알림</h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', fontWeight: '700' }} onClick={() => setShowNotifications(false)}>닫기 ✕</span>
                    </div>
                    <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '10px' }}>
                      {notifications.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '30px 0', margin: 0, fontWeight: '700' }}>새로운 알림이 없습니다.</p>
                      ) : (
                        notifications.map(noti => {
                          // 🔥 [핵심 수정 3] 화면에 뿌려줄 때도 두 방식 모두 완벽 호환!
                          const timeObj = noti.timestamp || noti.createdAt;
                          const isUnread = (timeObj?.toDate ? timeObj.toDate().getTime() : 0) > lastReadTime;
                          return (
                            <div key={noti.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '5px', background: isUnread ? '#eff6ff' : 'transparent', borderRadius: '8px' }}>
                              <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: '700' }}>{getNotificationText(noti.action, noti.seatLabel)}</span>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                                {timeObj?.toDate ? timeObj.toDate().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '방금 전'}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', margin: 0, padding: 0 }}>
              <button onClick={() => setViewMode(viewMode === 'MYPAGE' ? 'MAP' : 'MYPAGE')} style={{ background: viewMode === 'MYPAGE' ? '#2563eb' : '#f1f5f9', color: viewMode === 'MYPAGE' ? '#fff' : '#334155', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '0.85rem', padding: '10px 16px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s ease' }}>
                {viewMode === 'MYPAGE' ? '배치도' : '마이페이지'}
              </button>
              <button onClick={async () => { if (window.confirm("로그아웃 하시겠습니까?")) await signOut(auth); }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '0.85rem', padding: '10px 16px', cursor: 'pointer' }}>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {isAdmin && viewMode === 'USERS' && (
        <AdminDashboard now={now} isExamActive={isExamActive} examStartDate={examStartDate} setExamStartDate={setExamStartDate} examEndDate={examEndDate} setExamEndDate={setExamEndDate} saveExamPeriod={saveExamPeriod} clearExamPeriod={clearExamPeriod} />
      )}

      {viewMode === 'MYPAGE' && ( <MyPage user={user} setViewMode={setViewMode} /> )}
      {viewMode === 'SCANNER' && ( <ScannerPage setViewMode={setViewMode} /> )}

      {viewMode === 'MAP' && (
        <>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '10px 20px', borderRadius: '12px', border: '2px solid #cbd5e1' }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#fff', border: '2px solid #94a3b8' }}></div> <span style={{fontWeight:'900', color: '#0f172a', fontSize: '0.9rem'}}>이용 가능</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '10px 20px', borderRadius: '12px', border: '2px solid #cbd5e1' }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#fef08a', border: '2px solid #ca8a04' }}></div> <span style={{fontWeight:'900', color: '#0f172a', fontSize: '0.9rem'}}>예약됨</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '10px 20px', borderRadius: '12px', border: '2px solid #cbd5e1' }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#bbf7d0', border: '2px solid #16a34a' }}></div> <span style={{fontWeight:'900', color: '#0f172a', fontSize: '0.9rem'}}>사용 중</span></div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', width: '100%'}}>
            {['1층', '2층', '4층'].map(floor => (
              <button key={floor} onClick={() => setActiveFloor(floor)} style={{ flex: 1, padding: '16px 0', borderRadius: '15px', border: 'none', background: activeFloor === floor ? '#466dc9' : '#fff', color: activeFloor === floor ? '#fff' : '#475569', fontWeight: '900', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer', transition: '0.2s' }}>{floor}</button>
            ))}
          </div>

          {seats.length === 0 ? (
            <div style={{ width: '100%', padding: '50px 0', textAlign: 'center', background: '#fff', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#475569', fontWeight: '900', marginBottom: '10px' }}>⏳ 도서관 좌석을 불러오는 중입니다...</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>네트워크 상태에 따라 조금 걸릴 수 있습니다.</p>
              <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: '900', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                🔄 새로고침
              </button>
            </div>
          ) : (
            <FloorMap activeFloor={activeFloor} title={floorTitles[activeFloor]} seats={seats} user={user} isAdmin={isAdmin} currentUserData={currentUserData} viewMode={viewMode} now={now} setSelectedSeat={setSelectedSeat} setShowCancelWarning={setShowCancelWarning} />
          )}
          
          <SeatModal
            selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat}
            user={user} isAdmin={isAdmin} currentUserData={currentUserData}
            showCancelWarning={showCancelWarning} setShowCancelWarning={setShowCancelWarning} cancelWarningData={cancelWarningData}
            reservationStep={reservationStep} setReservationStep={setReservationStep}
            reserveHours={reserveHours} setReserveHours={setReserveHours}
            reminderMinutes={reminderMinutes} setReminderMinutes={setReminderMinutes}
            hasReserved={hasReserved} showSeatQR={showSeatQR} setShowSeatQR={setShowSeatQR}
            qrString={qrString} setQrString={setQrString} timeLeft={timeLeft} setTimeLeft={setTimeLeft}
            handleAction={(id, actionType, hours) => {
              handleLibraryAction({
                actionType: actionType, seat: selectedSeat, user, isAdmin, isExamPeriod, now, 
                reminderMinutes, setSelectedSeat, setShowCancelWarning, setCancelWarningData, hours,
                setShowSeatQR
              });
            }}
            calculateElapsedTime={(start) => calculateElapsedTime(start, now)}
            handleCancelClick={handleCancelClick}
          />
        </>
      )}
    </div>
  );
}

export default App;