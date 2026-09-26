import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { Booky } from '@/components/booky';
import { ExternalLink } from '@/components/settings/SettingsControls';
import { Button, Card, Heading, Text } from '@/components/ui';
import licences from '@/generated/licences.json';
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
    .map(([licence, n]) => `${n} ${licence}`)
    .join(', ');
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
    <SettingsPage title="About MyShelf" testID={T.root} backTestID={T.back}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Booky expression="happy" size={96} />
        <Text variant="bodyStrong" align="center" testID={T.version}>
          {`Version ${appVersion()} · ${appBuild()}`}
        </Text>
        <Text color="inkMuted" align="center">
          A cosy catalogue for the books you own, and a note of who borrowed which.
        </Text>
      </View>

      <Card title="Book details and covers" eyebrow="With thanks" testID={T.attribution}>
        <View style={{ gap: spacing.sm }}>
          <Text>Book data from Open Library (Internet Archive) and Google Books.</Text>
          <Text color="inkMuted">
            Cover images come from the same two places: Open Library’s covers and Google Books thumbnails. Each cover belongs to its publisher or artist; MyShelf only shows it next to your copy.
          </Text>
          <ExternalLink label="Open Library" url="https://openlibrary.org" onOpen={open} />
          <ExternalLink label="Google Books" url="https://books.google.com" onOpen={open} />
        </View>
      </Card>

      <Card title="Free and open source" eyebrow="Licence">
        <View style={{ gap: spacing.sm }}>
          <Text>MyShelf is free software under the MIT licence. Anyone can read, use and improve the code.</Text>
          <ExternalLink label="MyShelf on GitHub" url={REPO_URL} onOpen={open} testID={T.repoLink} />
        </View>
      </Card>

      <Card title="Your privacy" eyebrow="Privacy">
        <View style={{ gap: spacing.sm }}>
          <Text>
            Your library stays on this phone. There are no accounts, analytics or ads. To find details and covers, MyShelf sends only ISBNs and the words you search for to Open Library and Google Books — never your notes or who borrowed what.
          </Text>
          <ExternalLink label="Read the privacy notes" url={PRIVACY_URL} onOpen={open} testID={T.privacyLink} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }} testID={T.licences}>
        <Heading level={2}>Open-source licences</Heading>
        <Text color="inkMuted">{`MyShelf is built with ${packages.length} open-source packages: ${summary}.`}</Text>
        <Button
          label={showAll ? 'Hide the package list' : `Show all ${packages.length} packages`}
          variant="secondary"
          expanded={showAll}
          onPress={() => setShowAll((v) => !v)}
          testID={T.licencesToggle}
        />
        {showAll ? (
          <View role="list" aria-label="Open-source packages" style={{ gap: 2 }}>
            {packages.map((p) => (
              <Text key={`${p.name}@${p.version}`} role="listitem" variant="caption" testID={T.licenceRow}>
                {`${p.name} ${p.version} — ${p.license}`}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </SettingsPage>
  );
}
