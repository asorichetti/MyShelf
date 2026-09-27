import { renderHook } from '@testing-library/react-native';
import { StrictMode, type ReactNode } from 'react';

import { useMounted } from '@/hooks/useMounted';

describe('useMounted', () => {
  it('is true while mounted and false once unmounted', () => {
    const { result, unmount } = renderHook(() => useMounted());
    expect(result.current.current).toBe(true);
    unmount();
    expect(result.current.current).toBe(false);
  });

  it("is true after React's development double mount", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useMounted(), { wrapper });
    expect(result.current.current).toBe(true);
  });
});
