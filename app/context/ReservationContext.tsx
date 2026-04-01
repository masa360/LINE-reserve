'use client';

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import type { ReservationState, ReservationAction } from '@/types';

const initialState: ReservationState = {
  selectedMenu: null,
  selectedStyleMenu: null,
  selectedCareMenu: null,
  selectedStaff: null,
  selectedDate: null,
  selectedTime: null,
  customerName: '田中 花子',
  notes: '',
};

function reservationReducer(
  state: ReservationState,
  action: ReservationAction,
): ReservationState {
  switch (action.type) {
    case 'SET_MENU':
      return { ...state, selectedMenu: action.payload, selectedTime: null };
    case 'SET_STYLE_MENU':
      return { ...state, selectedStyleMenu: action.payload, selectedTime: null };
    case 'SET_CARE_MENU':
      return { ...state, selectedCareMenu: action.payload, selectedTime: null };
    case 'SET_STAFF':
      return { ...state, selectedStaff: action.payload, selectedTime: null };
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload, selectedTime: null };
    case 'SET_TIME':
      return { ...state, selectedTime: action.payload };
    case 'SET_CUSTOMER_NAME':
      return { ...state, customerName: action.payload };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'APPLY_REBOOK_PATCH':
      return {
        ...state,
        selectedMenu: action.payload.selectedMenu,
        selectedStyleMenu: action.payload.selectedStyleMenu,
        selectedCareMenu: action.payload.selectedCareMenu,
        selectedStaff: action.payload.selectedStaff,
        selectedDate: null,
        selectedTime: null,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface ReservationContextValue {
  state: ReservationState;
  dispatch: React.Dispatch<ReservationAction>;
}

const ReservationContext = createContext<ReservationContextValue | null>(null);

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reservationReducer, initialState);
  return (
    <ReservationContext.Provider value={{ state, dispatch }}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation(): ReservationContextValue {
  const ctx = useContext(ReservationContext);
  if (!ctx) {
    throw new Error('useReservation は ReservationProvider の内部で使用してください');
  }
  return ctx;
}
