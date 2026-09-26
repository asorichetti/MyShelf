import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface TypedIsbnFieldProps {
  onSubmit: (isbn: string) => void;
  disabled?: boolean;
  label?: string;
}

/** "Type an ISBN": the typed stand-in for a barcode (the web harness, and "Type ISBN instead" on a phone). */
export function TypedIsbnField({ onSubmit, disabled, label = 'Type an ISBN' }: TypedIsbnFieldProps) {
  const { spacing } = useTheme();
  const [text, setText] = useState('');
  const submit = () => text.trim() && onSubmit(text);
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <View style={styles.field}>
        <TextField
          label={label}
          value={text}
          onChangeText={setText}
          placeholder="e.g. 978-0-552-16659-1"
          keyboardType="number-pad"
          inputMode="numeric"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={submit}
          editable={!disabled}
          testID={Testids.scan.webIsbn}
          helperText="The 10 or 13 digits above the barcode."
        />
      </View>
      <Button label="Look up" onPress={submit} disabled={disabled} testID={Testids.scan.webIsbnSubmit} />
    </View>
  );
}

export interface TypedCoverTextFieldProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

/** "Type the cover text": the typed stand-in for reading a cover; each line is read like a line on the cover. */
export function TypedCoverTextField({ onSubmit, disabled }: TypedCoverTextFieldProps) {
  const { spacing } = useTheme();
  const [text, setText] = useState('');
  const submit = () => text.trim() && onSubmit(text);
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label="Type the cover text"
        value={text}
        onChangeText={setText}
        placeholder={'e.g. THE COLOUR OF MAGIC\nTERRY PRATCHETT'}
        multiline
        autoCorrect={false}
        editable={!disabled}
        testID={Testids.scan.webText}
        helperText="The title and author as they appear on the cover, one per line."
      />
      <Button label="Search" onPress={submit} disabled={disabled} testID={Testids.scan.webTextSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  field: { flexGrow: 1, flexBasis: 200 },
});
