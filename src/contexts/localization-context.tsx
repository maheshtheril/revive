'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { 
  DEFAULT_DATE_FORMAT, 
  DEFAULT_PRECISION, 
  formatDate as libFormatDate, 
  formatCurrencyWithSymbol as libFormatCurrencyWithSymbol,
  formatNumber as libFormatNumber
} from '@/lib/format-utils';

interface LocalizationContextType {
  dateFormat: string;
  precision: number;
  currencySymbol: string;
  formatDate: (date: Date | string | number, overrideFormat?: string) => string;
  formatCurrency: (amount: number, symbol?: string, overridePrecision?: number) => string;
  formatNumber: (amount: number, overridePrecision?: number) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  
  const user = session?.user as any;
  const dateFormat = user?.dateFormat || DEFAULT_DATE_FORMAT;
  const precision = user?.precision ?? DEFAULT_PRECISION;
  const currencySymbol = user?.currencySymbol || 'Rs.';

  const formatDate = (date: Date | string | number, overrideFormat?: string) => {
    return libFormatDate(date, overrideFormat || dateFormat);
  };

  const formatCurrency = (amount: number, symbol?: string, overridePrecision?: number) => {
    return libFormatCurrencyWithSymbol(amount, symbol || currencySymbol, overridePrecision ?? precision);
  };

  const formatNumber = (amount: number, overridePrecision?: number) => {
    return libFormatNumber(amount, overridePrecision ?? precision);
  };

  return (
    <LocalizationContext.Provider value={{ 
      dateFormat, 
      precision, 
      currencySymbol,
      formatDate,
      formatCurrency,
      formatNumber
    }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    // Fallback if used outside provider
    return {
      dateFormat: DEFAULT_DATE_FORMAT,
      precision: DEFAULT_PRECISION,
      currencySymbol: 'Rs.',
      formatDate: (date: Date | string | number, f?: string) => libFormatDate(date, f || DEFAULT_DATE_FORMAT),
      formatCurrency: (amount: number, s?: string, p?: number) => libFormatCurrencyWithSymbol(amount, s || 'Rs.', p ?? DEFAULT_PRECISION),
      formatNumber: (amount: number, p?: number) => libFormatNumber(amount, p ?? DEFAULT_PRECISION)
    };
  }
  return context;
};
