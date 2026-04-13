import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore'; 
// 🚨 기존에 있던 import { subscribeToSeats } ... 이 줄은 지우셔도 됩니다!

export const useLibraryData = () => {
  const [seats, setSeats] = useState([]);
  const [user, setUser] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 

  // 1. 로그인 상태 감시
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  // 🔥 2. [가장 중요한 핵심] 외부 API 버리고 여기서 직통으로 실시간 감시!
  useEffect(() => {
    setIsLoading(true);

    // 앱이 켜지자마자 Seats 컬렉션을 24시간 실시간 감시(onSnapshot)합니다.
    const unsubSeats = onSnapshot(collection(db, "Seat"), (snapshot) => {
      const seatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 좌석 번호(id) 순서대로 예쁘게 정렬
      const sorted = seatsData.sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true })
      );

      setSeats(sorted);      // 정렬된 좌석 넣기
      setIsLoading(false);   // 좌석이 들어오는 즉시 로딩 끝!
    }, (error) => {
      console.error("🚨 파이어베이스 좌석 에러:", error);
      setIsLoading(false);
    });

    // 화면이 꺼지면 실시간 감시 종료
    return () => unsubSeats();
  }, []); // 🚨 핵심: 로그인 상관없이 무조건 켜지자마자 1회 실행 후 계속 감시!

  // 3. 내 상세 정보(User 컬렉션) 실시간 구독
  useEffect(() => {
    if (!user) {
      setCurrentUserData(null);
      return;
    }
    const studentNo = user.email.split('@')[0];
    const unsubUser = onSnapshot(doc(db, "User", studentNo), (snap) => {
      if (snap.exists()) setCurrentUserData(snap.data());
    });
    return () => unsubUser();
  }, [user]);

  return { seats, user, currentUserData, isLoading, setSeats, setUser };
};