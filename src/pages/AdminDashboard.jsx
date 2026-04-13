import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment, query, where } from 'firebase/firestore';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AdminDashboard = ({ 
  now, 
  isExamActive, examStartDate, setExamStartDate, 
  examEndDate, setExamEndDate, 
  saveExamPeriod, clearExamPeriod 
}) => {
  // App.jsx에서 가져온 관리자 전용 상태들
  const [usersList, setUsersList] = useState([]); 
  const [tempSearch, setTempSearch] = useState(''); 
  const [debouncedSearch, setDebouncedSearch] = useState(''); 
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  // 1. 검색어 딜레이(Debounce) 로직
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(tempSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [tempSearch]);

  // 2. 유저 목록 및 통계 데이터 불러오기 함수
  const loadUsers = async () => {
    try {
      // 유저 목록 불러오기
      const querySnapshot = await getDocs(collection(db, "User"));
      const usersData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      usersData.sort((a, b) => (a.studentNo || "").localeCompare(b.studentNo || ""));
      setUsersList(usersData);

      // 통계 차트 데이터 불러오기 (최근 7일 기준 등)
      const logsRef = collection(db, 'Log'); // 'logs'인지 'Log'인지 기존 코드에 맞춤
      const logSnap = await getDocs(logsRef); 

      const labels = [];
      const dataMap = {}; 
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`; 
        labels.push(dateStr);
        dataMap[dateStr] = 0; 
      }

      logSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.action === 'COMPLETED' && data.createdAt) { // 'RETURN' 또는 'COMPLETED'
          const date = data.createdAt.toDate();
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
          if (dataMap[dateStr] !== undefined) {
            dataMap[dateStr] += 1;
          }
        }
      });

      setChartData({
        labels: labels,
        datasets: [
          {
            label: '도서관 실제 이용 완료(퇴실) 횟수',
            data: labels.map(label => dataMap[label]),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#2563eb',
            borderWidth: 1,
            borderRadius: 6,
            hoverBackgroundColor: '#1d4ed8'
          }
        ]
      });
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  // 화면이 켜지면 데이터 로드
  useEffect(() => {
    loadUsers();
  }, []);

  // 3. 패널티 사면 처리 함수
  const handleResetPenaltyOnly = async (studentNo, studentName) => {
    if (window.confirm(`${studentName}(${studentNo}) 학생의 이용정지를 해제하시겠습니까?\n(취소/제재 기록은 유지되며, 사면 횟수가 기록됩니다.)`)) {
      try {
        const userRef = doc(db, "User", studentNo);
        await updateDoc(userRef, {
          penaltyUntil: null, 
          resetCount: increment(1) 
        });
        alert(`✅ ${studentName} 학생의 이용정지가 해제되었습니다.`);
        loadUsers(); 
      } catch (error) {
        console.error("사면 처리 실패:", error);
        alert("사면 처리 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: window.innerWidth < 600 ? '15px' : '30px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 상단 1열: 시험 모드 설정 & 차트 */}
      <div style={{ display: 'flex', gap: window.innerWidth < 600 ? '15px' : '30px', flexWrap: 'wrap' }}>
        
        {/* 1-1. 시험 기간 통제 */}
        <div style={{ flex: '1', background: '#fff', padding: window.innerWidth < 600 ? '20px' : '30px', borderRadius: '25px', boxShadow: '0 5px 20px rgba(0,0,0,0.05)', minWidth: window.innerWidth < 850 ? '100%' : '400px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <h2 style={{ color: '#0f172a', fontSize: '1.4rem', marginBottom: '20px', borderLeft: '6px solid #2563eb', paddingLeft: '15px', fontWeight: '900' }}>⚙️ 시험 기간 외부인 통제</h2>
          <div style={{ background: isExamActive ? '#eff6ff' : '#f8fafc', padding: window.innerWidth < 600 ? '15px' : '25px', borderRadius: '20px', border: `2px solid ${isExamActive ? '#3b82f6' : '#e2e8f0'}`, transition: 'all 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <strong style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '900' }}>🎓 시험 기간 모드</strong>
              <span style={{ background: isExamActive ? '#2563eb' : '#f1f5f9', color: isExamActive ? '#fff' : '#64748b', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '900' }}>{isExamActive ? '가동 중' : '일반 모드'}</span>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
              
              {/* 1. 시작 일시 입력칸 */}
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '900', color: '#475569' }}>시작 일시</label>
                <div style={{ position: 'relative', width: '100%', height: '50px' }}>
                  
                  {/* 눈에 보이는 예쁜 디자인 박스 (pointerEvents: 'none'으로 클릭 무시) */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', padding: '0 15px', borderRadius: '12px', border: '2px solid #cbd5e1', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset', color: examStartDate ? '#000000' : '#94a3b8', fontWeight: '700', fontSize: '0.95rem', pointerEvents: 'none' }}>
                    <span>{examStartDate ? examStartDate.replace('T', ' ') : '연도. 월. 일. -- : --'}</span><span style={{ fontSize: '1.2rem' }}>📅</span>
                  </div>
                  
                  {/* 진짜 달력 인풋 (가장 위에 투명하게 덮음) */}
                  <input 
                    type="datetime-local" 
                    value={examStartDate} 
                    onChange={e => setExamStartDate(e.target.value)} 
                    onClick={(e) => {
                      // e.preventDefault() 삭제! (이게 달력을 막고 있었음)
                      if (e.target.showPicker) e.target.showPicker();
                    }} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', boxSizing: 'border-box', zIndex: 10 }} 
                  />
                </div>
              </div>

              {/* 2. 종료 일시 입력칸 */}
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '900', color: '#475569' }}>종료 일시</label>
                <div style={{ position: 'relative', width: '100%', height: '50px' }}>
                  
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', padding: '0 15px', borderRadius: '12px', border: '2px solid #cbd5e1', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset', color: examEndDate ? '#000000' : '#94a3b8', fontWeight: '700', fontSize: '0.95rem', pointerEvents: 'none' }}>
                    <span>{examEndDate ? examEndDate.replace('T', ' ') : '연도. 월. 일. -- : --'}</span><span style={{ fontSize: '1.2rem' }}>📅</span>
                  </div>
                  
                  <input 
                    type="datetime-local" 
                    value={examEndDate} 
                    onChange={e => setExamEndDate(e.target.value)} 
                    onClick={(e) => {
                      if (e.target.showPicker) e.target.showPicker();
                    }} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', boxSizing: 'border-box', zIndex: 10 }} 
                  />
                </div>
              </div>
            </div>

            {/* 설정 저장 버튼 */}
            <button onClick={() => { if (window.confirm(isExamActive ? "해제하시겠습니까?" : "시작하시겠습니까?")) isExamActive ? clearExamPeriod() : saveExamPeriod(); }} style={{ width: '100%', padding: '16px', background: isExamActive ? '#ef4444' : '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)' }}>
              {isExamActive ? '❌ 통제 해제' : '✅ 설정 저장 및 통제 시작'}
            </button>
          </div>
        </div>

        {/* 1-2. 이용 현황 차트 */}
        <div style={{ flex: '1.5', background: '#fff', padding: window.innerWidth < 600 ? '20px' : '30px', borderRadius: '25px', boxShadow: '0 5px 20px rgba(0,0,0,0.05)', minWidth: window.innerWidth < 600 ? '100%' : '500px', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#0f172a', fontSize: window.innerWidth < 600 ? '1.2rem' : '1.5rem', marginBottom: '20px', borderLeft: '6px solid #2563eb', paddingLeft: '15px', fontWeight: '900' }}>📈 일별 이용 현황 (퇴실 기준)</h2>
          <div style={{ height: window.innerWidth < 600 ? '200px' : '280px' }}>
            <Bar data={chartData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* 하단 2열: 회원 관리 테이블 */}
      <div style={{ background: '#fff', padding: window.innerWidth < 600 ? '20px' : '40px', borderRadius: '25px', boxShadow: '0 5px 20px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ color: '#111', fontSize: window.innerWidth < 600 ? '1.4rem' : '1.8rem', marginBottom: '25px', borderLeft: '8px solid #0056b3', paddingLeft: '15px', fontWeight: '900' }}>👥 회원 관리 대시보드</h2>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <input type="text" placeholder="학번 또는 이름으로 검색..." value={tempSearch} onChange={(e) => setTempSearch(e.target.value)} style={{ width: '100%', maxWidth: '300px', padding: '12px 15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
        </div>
        <div style={{overflowX: 'auto', width: '100%', borderRadius: '15px', border: '1px solid #e2e8f0', minHeight: '600px', background: '#fff'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px', tableLayout: 'fixed'}}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '3px solid #cbd5e1' }}>
                <th style={{padding: '15px', width: '130px', color: '#0f172a', fontWeight: '900'}}>학번</th>
                <th style={{padding: '15px', width: '100px', color: '#0f172a', fontWeight: '900'}}>이름</th>
                <th style={{padding: '15px', width: '100px', color: '#0f172a', fontWeight: '900'}}>이용 횟수</th>
                <th style={{padding: '15px', width: '220px', color: '#dc2626', fontWeight: '900'}}>누적 사고(취소/제재)</th>
                <th style={{padding: '15px', width: '100px', color: '#2563eb', fontWeight: '900'}}>패널티 초기화</th>
                <th style={{padding: '15px', width: '180px', color: '#b91c1c', fontWeight: '900'}}>정지 기한</th>
                <th style={{padding: '15px', width: '120px', color: '#0f172a', fontWeight: '900'}}>관리</th>
              </tr>
            </thead>
            <tbody>
              {usersList
                .filter(u => !['pjy', 'admin', 'manager', '1111111', '관리자'].includes(u.studentNo))
                .filter(u => (u.studentNo || '').includes(debouncedSearch) || (u.name || '').includes(debouncedSearch))
                .map((u) => {
                  const isSuspended = u.penaltyUntil && now < (u.penaltyUntil.toDate ? u.penaltyUntil.toDate() : new Date(u.penaltyUntil));
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0', background: isSuspended ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '15px', fontWeight: '800' }}>{u.studentNo}</td>
                      <td style={{ padding: '15px', fontWeight: '900' }}>{u.name}</td>
                      <td style={{ padding: '15px', fontWeight: '800', color: '#2563eb' }}>{u.totalUsageCount || 0}회</td>
                      <td style={{ padding: '15px', fontWeight: '800', color: '#dc2626' }}>취소 {u.cancelCount || 0} / 제재 {u.penaltyCount || 0}단계</td>
                      <td style={{ padding: '15px', fontWeight: '900', color: '#2563eb' }}>{u.resetCount || 0}회</td>
                      <td style={{ padding: '15px', fontWeight: '900', color: isSuspended ? '#b91c1c' : '#94a3b8' }}>
                        {isSuspended ? (u.penaltyUntil.toDate ? u.penaltyUntil.toDate().toLocaleString('ko-KR', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : new Date(u.penaltyUntil).toLocaleString()) : '-'}
                      </td>
                      <td style={{ padding: '15px', display: 'flex', gap: '8px' }}>
                        {isSuspended && (<button onClick={() => handleResetPenaltyOnly(u.studentNo, u.name)} style={{ padding: '6px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', fontSize: '0.8rem' }}>사면 처리</button>)}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;