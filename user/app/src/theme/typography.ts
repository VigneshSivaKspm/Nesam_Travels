import { fonts } from './index';

export const Typography = {
  h1: { fontFamily: fonts.extraBold, fontSize: 24, fontWeight: '800' as const },
  h2: { fontFamily: fonts.extraBold, fontSize: 20, fontWeight: '800' as const },
  h3: { fontFamily: fonts.bold, fontSize: 16, fontWeight: '700' as const },
  body: { fontFamily: fonts.regular, fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontFamily: fonts.bold, fontSize: 14, fontWeight: '700' as const },
  caption: { fontFamily: fonts.medium, fontSize: 12, fontWeight: '500' as const },
  small: { fontFamily: fonts.semiBold, fontSize: 10, fontWeight: '600' as const },
};
