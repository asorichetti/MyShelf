import { StyleSheet, Text, View } from 'react-native';

import { Testids } from '@/testing/testids.gen';

export default function HomeScreen() {
  return (
    <View style={styles.container} testID={Testids.pageState.content}>
      <View testID={Testids.home.root} role="main">
        <Text style={styles.title} role="heading" aria-level={1} testID={Testids.home.title}>
          MyShelf
        </Text>
        <Text style={styles.subtitle}>Your personal library, one shelf at a time.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3FC' },
  title: { fontSize: 32, fontWeight: '700', color: '#4B2A7B' },
  subtitle: { marginTop: 8, fontSize: 16, color: '#6E5A8E' },
});
