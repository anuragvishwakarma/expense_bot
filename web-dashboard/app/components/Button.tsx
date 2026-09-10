import { ReactNode } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children?: ReactNode;
}

export const Button = ({
  className = '',
  loading = false,
  children,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={`${className} flex w-items-center justify-center gap-2 rounded-md border font-medium transition-colors hover:bg-primary/80 focus:bg-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-primary bg-primary text-primary-foreground hover:bg-primary/80`}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <span className="flex h-4 w-4 items-center justify-center">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
        </span>
      ) : (
        children
      )}
    </button>
  );
};