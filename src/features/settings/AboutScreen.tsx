import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { Booky } from '@/components/booky';
import { ExternalLink } from '@/components/settings/SettingsControls';
import { Button, Card, Heading, Text } from '@/components/ui';
import licences from '@/generated/licences.json';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { appBuild, appVersion, PRIVACY_URL, REPO_URL } from './appInfo';
import { SettingsPage } from './SettingsPage';

const T = Testids.about;

interface LicencedPackage {
  name: string;
  version: string;
  license: string;
}

const packages = licences.packages as LicencedPackage[];

/** "518 MIT, 30 ISC, …": licences by how many packages use them. */
export function licenceSummary(list: readonly LicencedPackage[]): string {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(p.license, (counts.get(p.license) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([licence, n]) => t('about.licences.summaryItem', { count: n, licence }))
    .join(t('about.licences.summarySeparator'));
}

function open(url: string) {
  Linking.openURL(url).catch((e) => console.warn('Could not open the link', e));
}

/**
 * Settings → About MyShelf (P08-08): version and build, where book data and
 * covers come from, the MIT licence and the source code, a privacy summary,
 * and every open-source package the app ships with and its licence.
 */
export function AboutScreen() {
  const { spacing } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const summary = useMemo(() => licenceSummary(packages), []);

  return (
    <SettingsPage title={t('about.title')} testID={T.root} backTestID={T.back}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Booky expression="happy" size={96} />
        <Text variant="bodyStrong" align="center" testID={T.version}>
          {t('about.version', { version: appVersion(), build: appBuild() })}
        </Text>
        <Text color="inkMuted" align="center">
          {t('about.tagline')}
        </Text>
      </View>

      <Card title={t('about.attribution.title')} eyebrow={t('about.attribution.eyebrow')} testID={T.attribution}>
        <View style={{ gap: spacing.sm }}>
          <Text>{t('about.attribution.data')}</Text>
          <Text color="inkMuted">
            {t('about.attribution.covers')}
          </Text>
          <ExternalLink label={t('about.attribution.openLibrary')} url="https://openlibrary.org" onOpen={open} />
          <ExternalLink label={t('about.attribution.googleBooks')} url="https://books.google.com" onOpen={open} />
        </View>
      </Card>

      <Card title={t('about.licence.title')} eyebrow={t('about.licence.eyebrow')}>
        <View style={{ gap: spacing.sm }}>
          <Text>{t('about.licence.body')}</Text>
          <ExternalLink label={t('about.licence.repoLink')} url={REPO_URL} onOpen={open} testID={T.repoLink} />
        </View>
      </Card>

      <Card title={t('about.privacy.title')} eyebrow={t('about.privacy.eyebrow')}>
        <View style={{ gap: spacing.sm }}>
          <Text>{t('about.privacy.body')}</Text>
          <ExternalLink label={t('about.privacy.link')} url={PRIVACY_URL} onOpen={open} testID={T.privacyLink} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }} testID={T.licences}>
        <Heading level={2}>{t('about.licences.heading')}</Heading>
        <Text color="inkMuted">{t('about.licences.intro', { count: packages.length, summary })}</Text>
        <Button
          label={showAll ? t('about.licences.hide') : t('about.licences.showAll', { count: packages.length })}
          variant="secondary"
          expanded={showAll}
          onPress={() => setShowAll((v) => !v)}
          testID={T.licencesToggle}
        />
        {showAll ? (
          <View role="list" aria-label={t('about.licences.listLabel')} style={{ gap: 2 }}>
            {packages.map((p) => (
              <Text key={`${p.name}@${p.version}`} role="listitem" variant="caption" testID={T.licenceRow}>
                {t('about.licences.packageRow', { name: p.name, version: p.version, licence: p.license })}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </SettingsPage>
  );
}
