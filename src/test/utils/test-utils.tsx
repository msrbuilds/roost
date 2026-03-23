import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock AuthContext for testing
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>;
};

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <BrowserRouter>
      <MockAuthProvider>{children}</MockAuthProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for async updates
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// Mock file for upload testing
export const createMockFile = (
  name = 'test.png',
  size = 1024,
  type = 'image/png'
): File => {
  const blob = new Blob(['a'.repeat(size)], { type });
  return new File([blob], name, { type });
};

// Mock image for testing
export const createMockImage = (_width = 100, _height = 100): string => {
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
};

// Helper to mock window.location
export const mockWindowLocation = (url: string) => {
  delete (window as any).location;
  window.location = new URL(url) as any;
};

// Helper to suppress console errors in tests
export const suppressConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
};
