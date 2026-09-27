import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface TypedIsbnFieldProps {
  onSubmit: (isbn: string) => void;
  disabled?: boolean;
  label?: string;
}

/** "Type an ISBN": the typed stand-in for a barcode (the web harness, and "Type ISBN instead" on a phone). */
export function TypedIsbnField({ onSubmit, disabled, label }: TypedIsbnFieldProps) {
  const { spacing } = useTheme();
  const [text, setText] = useState('');
  const submit = () => text.trim() && onSubmit(text);
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <View style={styles.field}>
        <TextField
          label={label ?? t('scan.typed.isbnLabel')}
          value={text}
          onChangeText={setText}
          placeholder={t('scan.typed.isbnPlaceholder')}
          keyboardType="number-pad"
          inputMode="numeric"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={submit}
          editable={!disabled}
          testID={Testids.scan.webIsbn}
          helperText={t('scan.typed.isbnHelper')}
        />
      </View>
      <Button label={t('scan.typed.lookUp')} onPress={submit} disabled={disabled} testID={Testids.scan.webIsbnSubmit} />
    </View>
  );
}

export interface TypedCoverTextFieldProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  /** Words to start from: what the phone read off a cover it could not match. */
  initialText?: string;
}

/** "Type the cover text": the typed stand-in for reading a cover; each line is read like a line on the cover. */
export function TypedCoverTextField({ onSubmit, disabled, initialText = '' }: TypedCoverTextFieldProps) {
  const { spacing } = useTheme();
  const [text, setText] = useState(initialText);
  const submit = () => text.trim() && onSubmit(text);
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={t('scan.typed.coverLabel')}
        value={text}
        onChangeText={setText}
        placeholder={t('scan.typed.coverPlaceholder')}
        multiline
        autoCorrect={false}
        editable={!disabled}
        testID={Testids.scan.webText}
        helperText={t('scan.typed.coverHelper')}
      />
      <Button label={t('scan.typed.search')} onPress={submit} disabled={disabled} testID={Testids.scan.webTextSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  field: { flexGrow: 1, flexBasis: 200 },
});
