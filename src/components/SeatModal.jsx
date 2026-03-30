import React, { useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const SeatModal = ({
  selectedSeat, setSelectedSeat, user, isAdmin, currentUserData,
  showCancelWarning, setShowCancelWarning, cancelWarningData,
  reservationStep, setReservationStep, reserveHours, setReserveHours,
  reminderMinutes, setReminderMinutes, hasReserved,
  showSeatQR, setShowSeatQR, qrString, setQrString, timeLeft, setTimeLeft,
  handleAction, handleCancelClick, calculateElapsedTime
}) => {

  // 스캐너 인증 성공 시 팝업 띄우고 창 닫기
  useEffect(() => {
    // QR 화면이 켜져 있는데, 좌석 상태가 '사용 중(OCCUPIED)'으로 변했다면? = 스캔 성공!
    if (showSeatQR && selectedSeat?.status === 'OCCUPIED') {
      
      // 1. 사용자에게 기분 좋은 성공 알림 띄우기! 🎉
      alert("✅ 인증이 완료되었습니다. 좌석 사용을 시작합니다!");
      
      // 2. 창 닫기 로직 실행
      setShowSeatQR(false);
      setSelectedSeat(null);
    }
  }, [selectedSeat?.status, showSeatQR, setSelectedSeat, setShowSeatQR]);

  if (!selectedSeat) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', padding: '30px 20px', borderRadius: '25px', width: '100%', maxWidth: '380px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', boxSizing: 'border-box' }}>
        <h2 style={{ marginBottom: '20px', color: '#0f172a', fontWeight: '900', fontSize: '1.6rem', wordBreak: 'keep-all' }}>{selectedSeat.label}</h2>
        
        {selectedSeat.userId && (isAdmin || selectedSeat.userId === user?.email) && (
          <div style={{ background: '#f1f5f9', padding: '15px', borderRadius: '15px', marginBottom: '20px', textAlign: 'left', fontSize: '0.95rem', border: '2px solid #cbd5e1', wordBreak: 'break-all' }}>
            <p style={{ margin: '8px 0', color: '#0f172a' }}><b>이름:</b> {selectedSeat.userName || (selectedSeat.userId === user?.email ? currentUserData?.name : "기록 없음") || selectedSeat.userId.split('@')[0]}</p>
            <p style={{ margin: '8px 0', color: '#0f172a' }}><b>학번:</b> {selectedSeat.userId.split('@')[0]}</p>
            {isAdmin && selectedSeat.status === 'OCCUPIED' && (<p style={{ margin: '8px 0', color: '#dc2626', fontWeight: '900' }}><b>이용 시간:</b> ⏱️ {calculateElapsedTime(selectedSeat.startedAt)}</p>)}
          </div>
        )}

        {showCancelWarning && selectedSeat.status === 'RESERVED' && (selectedSeat.userId === user?.email || isAdmin) ? (
          <div style={{ background: '#fef2f2', padding: '20px 15px', borderRadius: '15px', border: '3px solid #f87171', animation: 'fadeIn 0.3s' }}>
            <h3 style={{ color: '#dc2626', margin: '0 0 15px 0', fontSize: '1.3rem', fontWeight: '900' }}>⚠️ 패널티 경고</h3>
            <p style={{ color: '#7f1d1d', fontSize: '0.95rem', marginBottom: '10px', lineHeight: '1.5', fontWeight: '700' }}>정말 예약을 취소하시겠습니까?</p>
            <div style={{ background: '#fca5a5', padding: '10px', borderRadius: '10px', marginBottom: '20px' }}>
              <p style={{ margin: '5px 0', color: '#7f1d1d', fontWeight: '900', fontSize: '0.9rem' }}>[현재 내 계정 상태]</p>
              <p style={{ margin: '5px 0', color: '#7f1d1d', fontWeight: '700', fontSize: '0.9rem' }}>누적 취소: <span style={{fontSize:'1.1rem', color:'#991b1b'}}>{cancelWarningData?.cancelCount || 0}</span> 회 (3회 시 정지)</p>
              <p style={{ margin: '5px 0', color: '#7f1d1d', fontWeight: '700', fontSize: '0.9rem' }}>받은 패널티: <span style={{fontSize:'1.1rem', color:'#991b1b'}}>{cancelWarningData?.penaltyCount || 0}</span> 단계</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleAction(selectedSeat.id, 'CANCEL')} style={{ flex: 1, padding: '14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' }}>예(취소)</button>
              <button onClick={() => setShowCancelWarning(false)} style={{ flex: 1, padding: '14px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' }}>돌아가기</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px', width: '100%' }}>
            
            {selectedSeat.status === 'AVAILABLE' && (!hasReserved || isAdmin) && (
              <>
                {reservationStep === 1 ? (
                  <>
                    <select value={reserveHours} onChange={e => setReserveHours(Number(e.target.value))} style={{ width: '100%', padding: '16px', borderRadius: '15px', border: '2px solid #94a3b8', textAlign: 'center', fontWeight: '900', fontSize: '1rem', color: '#0f172a', backgroundColor: '#f8fafc', cursor: 'pointer', outline: 'none', boxSizing: 'border-box' }}>
                      {[1,2,3,4,5].map(h => <option key={h} value={h}>{h}시간 예약</option>)}
                    </select>
                    <button onClick={() => setReservationStep(2)} style={{ width: '100%', padding: '18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', fontSize: '1.1rem', transition: '0.2s', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)', boxSizing: 'border-box' }}>지금 예약하기</button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '15px', borderRadius: '15px', border: '2px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
                      <label style={{ fontSize: '1rem', fontWeight: '900', color: '#1e293b', textAlign: 'center' }}>⏰ 퇴실 사전 알림 설정</label>
                      <select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', textAlign: 'center', fontWeight: '900', fontSize: '0.95rem', color: '#0f172a', backgroundColor: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}>
                        <option value={10}>10분 전 알림</option>
                        <option value={15}>15분 전 알림</option>
                        <option value={20}>20분 전 알림 (기본)</option>
                        <option value={25}>25분 전 알림</option>
                        <option value={30}>30분 전 알림</option>
                        <option value={0}>알림 받지 않음</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button onClick={() => setReservationStep(1)} style={{ flex: 1, padding: '16px 0', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', fontSize: '1rem', transition: '0.2s' }}>⬅️ 뒤로</button>
                      <button onClick={() => { handleAction(selectedSeat.id, 'RESERVED', reserveHours); setReservationStep(1); }} style={{ flex: 2, padding: '16px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', fontSize: '1.1rem', transition: '0.2s', boxShadow: '0 4px 6px rgba(22, 163, 74, 0.3)' }}>✅ 최종 확정</button>
                    </div>
                  </>
                )}
              </>
            )}

            {selectedSeat.status === 'RESERVED' && (selectedSeat.userId === user?.email || isAdmin) && (
              <>
                {!isAdmin && (
                  !showSeatQR ? (
                    <button 
                      onClick={() => {
                        const studentId = user?.studentNo || user?.email?.split('@')[0];
                        setQrString(`${studentId}_${Date.now()}`); 
                        setTimeLeft(15); 
                        setShowSeatQR(true);
                      }} 
                      style={{ width: '100%', padding: '18px', background: '#24c15e', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxSizing: 'border-box', marginBottom: '8px' }}
                    >
                      QR 인증하기
                    </button>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '8px', border: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p style={{ margin: '0 0 10px 0', fontWeight: '900', color: '#0f172a' }}>입구 키오스크에 스캔하세요</p>
                      <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <QRCodeCanvas value={qrString} size={150} />
                      </div>
                      <p style={{ color: '#dc2626', fontWeight: '900', marginTop: '15px', fontSize: '1.1rem', animation: timeLeft <= 5 ? 'blink 1s infinite' : 'none' }}>
                        남은 시간: {timeLeft}초
                      </p>
                      <button onClick={() => setShowSeatQR(false)} style={{ marginTop: '10px', padding: '8px 20px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer' }}>
                        QR 닫기
                      </button>
                    </div>
                  )
                )}
                {isAdmin && (
                  <button onClick={() => handleAction(selectedSeat.id, 'OCCUPY')} style={{ width: '100%', padding: '18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxSizing: 'border-box', marginBottom: '8px' }}>
                    착석 인증 완료 (수동)
                  </button>
                )}
                {!showSeatQR && (
                  <button onClick={handleCancelClick} style={{ width: '100%', padding: '18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxSizing: 'border-box', marginBottom: '8px' }}>
                    예약 취소
                  </button>
                )}
              </>
            )}

            {selectedSeat.status === 'OCCUPIED' && (selectedSeat.userId === user?.email || isAdmin) && (
              <button onClick={() => handleAction(selectedSeat.id, 'RETURN')} style={{ width: '100%', padding: '18px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxSizing: 'border-box' }}>퇴실 및 반납</button>
            )}

            {isAdmin && (
              <button 
                onClick={() => handleAction(selectedSeat.id, selectedSeat.status === 'DISABLED' ? 'ENABLE' : 'DISABLE')} 
                style={{ width: '100%', padding: '18px', background: selectedSeat.status === 'DISABLED' ? '#2563eb' : '#e34646', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxSizing: 'border-box', marginTop: '4px' }}
              >
                {selectedSeat.status === 'DISABLED' ? '좌석 다시 개방하기' : '좌석 비활성화'}
              </button>
            )}

            <button 
              onClick={() => { 
                setSelectedSeat(null); setShowCancelWarning(false); setReservationStep(1); setShowSeatQR(false); 
              }} 
              style={{ width: '100%', padding: '18px', background: '#475569', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', fontSize: '1.1rem', transition: '0.2s', boxShadow: '0 4px 10px rgba(71, 85, 105, 0.3)', marginTop: '4px', boxSizing: 'border-box' }}
            >
              창 닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatModal;