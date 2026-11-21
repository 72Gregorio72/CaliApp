import { requireOptionalNativeModule } from 'expo';

type WorkoutPip = {
  /** Abilita/disabilita l'ingresso automatico in Picture-in-Picture quando l'utente va alla home. */
  setPipEnabled(enabled: boolean): void;
  /** Notifica fissa. chronometer=true: Android conta da solo partendo da whenMs (anche ad app chiusa). */
  showTimer(title: string, text: string, whenMs: number, chronometer: boolean, countDown: boolean): void;
  hideTimer(): void;
};

// null su iOS/web/Expo Go: le chiamate diventano no-op.
export default requireOptionalNativeModule<WorkoutPip>('WorkoutPip');
