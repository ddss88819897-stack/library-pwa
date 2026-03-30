import { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore'; 

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

  useUserSession(user);

  const now = useLibrarySystem(
    seats, user, isAdmin, isExamActive, examEndDate,
    setExamStartDate, setExamEndDate, setIsExamActive
  );

  const isExamPeriod = Boolean(
    isExamActive && examStartDate && examEndDate && 
    now >= new Date(examStartDate) && now <= new Date(examEndDate)
  );

  const hasReserved = seats.some(seat => seat.userId === user?.email);

  // 🔥 실시간 좌석 상태 동기화 (QR 인증 시 모달창 자동 닫힘을 위해 필수!)
  useEffect(() => {
    if (selectedSeat) {
      // 전체 좌석 데이터(seats) 중에 내가 지금 띄워놓은 좌석(selectedSeat)의 최신 상태를 찾음
      const liveSeat = seats.find(s => s.id === selectedSeat.id);
      
      // 만약 DB의 최신 상태(liveSeat)와 모달창이 알고 있는 상태가 다르면? -> 최신 상태로 덮어씌움!
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
      // 15초 끝나면 QR 숨기기 (보안상 자동 폐기)
      setShowSeatQR(false);
      alert("⌛ 보안을 위해 QR 코드가 만료되었습니다. 다시 눌러주세요.");
    }
    return () => clearInterval(timer);
  }, [showSeatQR, timeLeft]);

  

  const saveExamPeriod = async () => {
    if (!examStartDate || !examEndDate) return alert("날짜와 시간을 입력해주세요.");
    await setDoc(doc(db, "System", "config"), { examStartDate, examEndDate, isExamActive: true }, { merge: true });
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
            <p style={{ margin: 0, padding: 0, lineHeight: 1, fontWeight: '900', color: '#475569', fontSize: '0.95rem' }}>
              👤 {user?.email?.split('@')[0]}님 {isAdmin && <span style={{ color: '#b45309' }}>[관리자]</span>}
            </p>
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

          <FloorMap activeFloor={activeFloor} title={floorTitles[activeFloor]} seats={seats} user={user} isAdmin={isAdmin} currentUserData={currentUserData} viewMode={viewMode} now={now} setSelectedSeat={setSelectedSeat} setShowCancelWarning={setShowCancelWarning} />
          
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