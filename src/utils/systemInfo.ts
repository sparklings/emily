export interface SystemContext {
  locale: string;
  languageName: string;
  timeString: string;
  timePeriod: 'morning' | 'afternoon' | 'evening' | 'night';
}

/**
 * 클라이언트의 현재 로케일, 시스템 시각, 시간대(오전/오후/저녁/밤)를 계산하여 반환합니다.
 * @returns 로케일, 언어명, 시간 문자열, 시간대 구분 객체
 */
export function getSystemContext(): SystemContext {
  const now = new Date();
  const hours = now.getHours();
  let timePeriod: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';

  if (hours >= 6 && hours < 12) {
    timePeriod = 'morning';
  } else if (hours >= 12 && hours < 18) {
    timePeriod = 'afternoon';
  } else if (hours >= 18 && hours < 22) {
    timePeriod = 'evening';
  } else {
    timePeriod = 'night';
  }

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'ko-KR';
  let languageName = 'Korean';
  if (locale.startsWith('en')) {
    languageName = 'English';
  } else if (locale.startsWith('ja')) {
    languageName = 'Japanese';
  } else if (locale.startsWith('zh')) {
    languageName = 'Chinese';
  }

  return {
    locale,
    languageName,
    timeString: now.toLocaleTimeString(),
    timePeriod
  };
}
