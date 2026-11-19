# GymApp

App per organizzare e registrare i tuoi allenamenti in palestra: crei gli allenamenti, li metti in una scheda settimanale, li esegui con timer e contatore serie, e segui i progressi nel tempo. Tutti i dati restano sul telefono.

L'app ha 4 tab: **Home**, **Allenamenti**, **Schede**, **Stats**.

---

## Home

- **Allenamento di oggi**: mostra l'allenamento previsto oggi dalla scheda attiva, con numero di esercizi e serie. Tocca **Inizia allenamento** per partire. Se oggi non c'è niente, vedi "Giorno di riposo".
- **Allenamento in sospeso**: se esci da una sessione senza terminarla, compare una card con le serie già fatte. **Riprendi** per continuare, il cestino per scartarla.
- **Settimana**: la striscia dei 7 giorni della scheda attiva. Tocca un giorno per vedere l'allenamento.
- **Statistiche rapide**: allenamenti della settimana, settimane di fila in cui ti sei allenato, volume della settimana (kg sollevati).
- **Calendario del mese**: i giorni in cui ti sei allenato sono colorati.
- **Scorciatoie**: *Nuovo allenamento* e *Nuova scheda*.
- **Icona nuvola → Backup dati** (vedi [Backup](#backup-e-ripristino)).
- **Icona tavolozza → Personalizza colori**: tema scuro on/off, colore primario e secondario (preset o selettore libero).

## Allenamenti

Elenco dei tuoi allenamenti. Su ogni card:

- **Inizia**: avvia la sessione.
- **Matita**: modifica.
- **Copia**: duplica (la copia condivide lo storico degli esercizi con l'originale).
- **Cestino**: elimina. Se l'allenamento è usato in una scheda, ti avvisa e quei giorni diventano di riposo.
- Tocca la card per i **dettagli**: esercizi, record per esercizio, superserie, note.

### Creare o modificare un allenamento

1. **+** in alto a destra (o *Nuovo allenamento* dalla Home).
2. Dai un nome all'allenamento.
3. **Aggiungi esercizio**: nome, serie, ripetizioni, recupero (`1:30` o `90` secondi). Ripetizioni `0` = "max".
4. **Aggiungi dai tuoi allenamenti**: riusa un esercizio esistente. Mantiene lo stesso storico e gli stessi record.
5. Su ogni esercizio:
   - **…** apre le opzioni: *Esercizio a tempo* (durata in secondi), *Note*, *Superserie con il successivo*, frecce per spostarlo.
   - **⇄** sostituisce l'esercizio con uno esistente.
   - **Cestino** lo elimina.
6. **Riordina**: tieni premuto un esercizio e trascinalo.
7. **Salva**.

Esercizi con lo stesso nome in allenamenti diversi vengono unificati automaticamente: "Panca piana" ha un unico storico ovunque compaia.

### Importare un allenamento da foto con l'AI

1. Nel form di un nuovo allenamento tocca **Importa da foto con l'AI**.
2. **Copia prompt** e incollalo in un'AI (ChatGPT, Claude, Gemini…) insieme alla foto della scheda.
3. Copia il JSON che ti risponde, incollalo nel campo e tocca **Importa**.
4. Controlla gli esercizi e salva.

## Sessione di allenamento

Si apre con *Inizia*. In alto: durata dell'allenamento, **✓** per salvare e terminare, **✕** per tornare alla Home lasciando l'allenamento in sospeso.

### Tab Esercizi

- Barra di avanzamento con esercizi e serie completati.
- Tocca un esercizio per renderlo quello **in corso**: vedi "Ultima volta" (data, serie × ripetizioni, peso), le note e i chip delle serie.
- **Chip delle serie**: tocca una serie per completarla (insieme a quelle prima); tocca una serie già fatta per annullarla. Ogni serie registra il peso impostato in quel momento.
- **⇄ Sostituisci**: cambia l'esercizio solo per questa sessione (es. macchina occupata). L'allenamento salvato non cambia. Riscegli l'originale per annullare.
- **Note sull'allenamento**: come è andata, dolori, sensazioni. Finiscono nello storico.

### Tab Timer

- **Recupero (countdown)**: parte dal recupero dell'esercizio. Play/pausa, reset, **+15 s**. A fine recupero il telefono vibra e compare un allarme a tutto schermo (tocca per fermarlo). Suona anche a schermo bloccato tramite notifica.
- **Cronometro**: per esercizi a tempo o tenute.
- **Serie − / +**: conta le serie. In una **superserie**, `+` passa automaticamente all'esercizio abbinato.
- **Peso / Ripetizioni / Tenuta**: registra il valore dell'esercizio. Scegli l'unità (kg, rep, secondi); vedi ultima volta e record. L'unità resta quella scelta l'ultima volta.
- **Registra video**: apre la fotocamera (grandangolo se disponibile) per filmare la serie e salvarla in galleria.
- **Esercizio successivo** / **Termina allenamento** in basso.

### Fine allenamento

Termina con il pulsante in basso o con **✓**. Vedi durata, serie fatte e kg sollevati; se hai battuto un record appare **"Nuovo record! 🎉"** con gli esercizi migliorati.

I progressi si salvano a ogni serie: se chiudi o l'app viene uccisa, riprendi dalla Home.

### Picture-in-Picture (Android)

Se esci dall'app durante un allenamento, compare una finestrella con esercizio, timer e serie, più una notifica fissa con il timer.

## Schede

Una scheda assegna un allenamento (o riposo) a ogni giorno della settimana.

- **+** per crearne una: nome, poi tocca ogni giorno per scegliere un allenamento, *Riposo* o *Crea allenamento*.
- **Importa scheda con l'AI**: come per gli allenamenti, ma da una foto della scheda settimanale. Crea tutti gli allenamenti e li assegna ai giorni.
- Tocca una scheda per espanderla:
  - **Usa come scheda attiva**: è quella che la Home usa per "Allenamento di oggi" e quella a cui vengono associate le sessioni.
  - **Modifica**, **Duplica**, **Elimina**.
  - **🔔 Promemoria**: per ogni giorno di allenamento attiva una notifica settimanale all'orario scelto (es. `18:30`). Suonano solo per la scheda attiva.

## Stats

- **Storico per scheda**: per ogni scheda, i giorni di allenamento e come sta andando ogni esercizio. Tocca un esercizio per il **grafico di progressione** (inizio, ultimo, record, elenco sessioni).
- **Volume settimanale**: grafico dei kg sollevati (serie × ripetizioni × peso) nelle ultime 12 settimane. Esercizi a rep o tenuta non contano.
- **Peso corporeo**: **Registra** per aggiungere una pesata; grafico dell'andamento e ultime pesate (cestino per eliminarle).
- **Storico generale**: calendario mensile, scorri o usa le frecce per cambiare mese. Tocca un giorno colorato per la **giornata**:
  - esercizi fatti con la variazione rispetto alla volta prima;
  - **matita** per correggere un valore sbagliato;
  - **video** della sessione: collegali dalla galleria o con un link Google Foto;
  - **cestino** per eliminare la sessione (grafici e record si ricalcolano).

## Backup e ripristino

Home → icona nuvola. Salva allenamenti, schede, storico, peso corporeo e scheda attiva (non i colori né la sessione in corso).

- **Salva backup su file**: crea un `.json` e apre la condivisione (Drive, email, WhatsApp…).
- **Ripristina da file**: scegli il `.json`. **Sostituisce** tutti i dati attuali.
- **Copia backup / Ripristina dagli appunti**: stessa cosa ma come testo.

Il backup viene validato per intero prima di scrivere: un file sbagliato non lascia i dati a metà.

> Fai un backup prima di disinstallare l'app: i dati sono solo sul telefono.

---

## Sviluppo

```bash
npm install          # applica anche le patch in patches/ (postinstall)
npx expo start       # Metro
npm run android      # build e avvio su Android
npm run lint
```

Promemoria, allarme di recupero a schermo bloccato e Picture-in-Picture **non funzionano in Expo Go**: serve una development build (`eas build --profile development`). APK installabile: `eas build --profile preview --platform android`.

In modalità sviluppo, la schermata Backup ha **Carica dati demo**: un mese di allenamenti finti su una scheda Push/Pull/Gambe (tutto con prefisso `demo_`, non tocca i dati reali).

Struttura:

- `app/` – schermate (expo-router): `(tabs)/` i 4 tab, `workouts/` form e sessione, `weekly-plans/` schede, storico, grafici.
- `components/` – form, picker, grafici, componenti della sessione.
- `context/` – stato e salvataggio (AsyncStorage): allenamenti, schede, storico, tema.
- `lib/` – backup, notifiche, statistiche, dati demo.
- `modules/workout-pip/` – modulo nativo Android per il Picture-in-Picture.
