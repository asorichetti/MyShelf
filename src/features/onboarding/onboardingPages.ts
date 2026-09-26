import { tipById, type BookyExpression } from '@/components/booky';
import { t } from '@/i18n';

export interface OnboardingPage {
  expression: BookyExpression;
  title: string;
  text: string;
}

/** The four first-run cards (P07-03), in the active language. Booky's words, short and warm. */
export function onboardingPages(): readonly OnboardingPage[] {
  return [
    { expression: 'happy', title: t('onboarding.welcome.title'), text: t('onboarding.welcome.text', { hello: tipById('welcome').text }) },
    { expression: 'thinking', title: t('onboarding.scan.title'), text: t('onboarding.scan.text') },
    { expression: 'happy', title: t('onboarding.lend.title'), text: t('onboarding.lend.text') },
    { expression: 'sleepy', title: t('onboarding.private.title'), text: t('onboarding.private.text') },
  ];
}
