# TODO GymApp

## Priorità alta
- [x] 1. Storico sessioni salvato a fine allenamento (`context/HistoryContext.tsx`)
- [x] 2. Conferma prima di uscire dalla sessione (Annulla / Scarta / Salva e termina)
- [x] 3. Peso numerico (kg) invece di testo libero (il vecchio testo resta come nota e precompila il peso se è un numero)
- [x] 4. Scheda attiva (tab Schede → "Usa come scheda attiva")

## Priorità media
- [x] 5. Statistiche vere in Home (allenamenti della settimana, settimane di fila, volume)
- [x] 6. Progressione per esercizio (record + grafico nei dettagli, "Nuovo record! 🎉" a fine allenamento)
- [x] 7. "Ultima volta: 3×8 · 70 kg" durante la sessione
- [x] 8. Riprendere una sessione interrotta (card "Allenamento in sospeso" in Home)

## Priorità bassa
- [x] 9. Backup/ripristino dati (Home → icona nuvola, JSON negli appunti)
- [x] 10. Duplica allenamento / scheda
- [x] 11. Riordina esercizi + superserie (opzioni "…" dell'esercizio nel form)
- [x] 12. Calendario mensile allenamenti (Home)

## Fix
- [x] ID schede univoci
- [x] Eliminare un allenamento lo toglie anche dalle schede (con avviso)
- [x] Spezzare session.tsx (`hooks/use-timers.ts`, `components/session/VideoRecorder.tsx`)
- [x] Modificare un allenamento non cancella più il vecchio peso salvato
- [x] Salvare il peso in sessione non azzera più le serie fatte

## Da provare sul telefono
- [ ] Un allenamento completo: serie, peso, termina → storico, statistiche, calendario
- [ ] Chiudere l'app a metà → "Riprendi" dalla Home
- [ ] Copia backup → ripristina
