// Centralized theme, fonts and assets for the app
export const colors = {
  light: {
    // Gradient using primary and secondary
    backgroundGradient: ['#3363AD', '#595F74'] as const,
    primary: '#3363AD',
    secondary: '#595F74',
    dark: '#373449',
    pageBackground: '#EFF1F8',
    // 70% opacity of primary
    primary70: 'rgba(51,99,173,0.7)',
    neutral: '#69695D',
    // 60% opacity of neutral
    neutral60: 'rgba(105,105,93,0.6)',
    cardBg: '#FFFFFF',
    cardText: '#111827',
    cardSubtitle: '#595F74',
    cardShadow: 'rgba(16,24,40,0.06)',
    error: '#ef4444'
  },
  dark: {
    // Dark gradient using dark and primary
    backgroundGradient: ['#373449', '#3363AD'] as const,
    primary: '#3363AD',
    secondary: '#595F74',
    dark: '#373449',
    pageBackground: '#1f1146',
    primary70: 'rgba(51,99,173,0.7)',
    neutral: '#69695D',
    neutral60: 'rgba(105,105,93,0.6)',
    cardBg: '#111827',
    cardText: '#f8fafc',
    cardSubtitle: 'rgba(255,255,255,0.75)',
    cardShadow: 'rgba(0,0,0,0.6)',
    error: '#ef4444'
  }
} as const;

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold'
};

export const assets = {
  ministrySeal: require('@/assets/logo/chw.png'),
  weltelIcon: require('@/assets/logo/weltelIcon.png'),
  etrainingIcon: require('@/assets/logo/chw.png'),
  cEMR: require('@/assets/logo/chwe.png'),
  rwanda: require('@/assets/logo/rwanda.png'),
  partner: require('@/assets/logo/partners.png'),
  rbc: require('@/assets/logo/rbc-logo.png'),
  studyplan: require('@/assets/auth/study-plan.png'),
  loginIcon: require('@/assets/auth/hand.png'),
  beginnerleft: require('@/assets/auth/beginner-left.png'),
  beginnerright: require('@/assets/auth/beginner-right.png'),
  advancedleft: require('@/assets/auth/advanced-left.png'),
  advancedright: require('@/assets/auth/advanced-right.png'),
  umujyanama: require('@/assets/header/umujyanama.png'),

  // Home screen illustrations
  hiv: require('@/assets/home/hiv.png'),
  ibikoresho: require('@/assets/home/ibikoresho.png'),
  ibyorezo: require('@/assets/home/ibyorezo.png'),
  kubonezaurubyaro: require('@/assets/home/kubonezaurubyaro.png'),
  malaria: require('@/assets/home/malaria.png'),
  ubutabazi: require('@/assets/home/ubutabazi.png'),
  ubuvuzi: require('@/assets/home/ubuvuzi.png'),
  umubyeyi: require('@/assets/home/umubyeyi.png'),
  umutwe: require('@/assets/home/umutwe.png'),
   imyitwarire: require('@/assets/home/imyitwarire.png'),

   // virtual simulation screen
   body: require('@/assets/virtual/body.png'),

   //community
   weltel: require('@/assets/community/weltel.png'),
   umujyanama1: require('@/assets/community/umujyanama1.png'),
   umujyanama2: require('@/assets/community/umujyanama2.png'),
   umujyanama3: require('@/assets/community/umujyanama3.png'),

  //  course
   speaker: require('@/assets/course/speaker.png'),
   thumbnail: require('@/assets/course/thumbnail.png'),
   header_background: require('@/assets/course/header_background.png'),
   videos: {
     trailer: require('@/assets/course/youngman_test_HIV_positive.mp4'),
   },
   play: require('@/assets/course/play.png'),
   camera: require('@/assets/course/camera.png'),
      book: require('@/assets/course/book.png'),
};
