# ConfirmModal - Componente Modale di Conferma Unificato

## Descrizione
Modal di conferma standardizzato per tutte le azioni che richiedono conferma utente nella piattaforma.

## Caratteristiche
- ✅ Design unificato con header colorato
- ✅ 4 varianti: `info`, `success`, `warning`, `danger`
- ✅ Supporto loading state
- ✅ Lista dettagli opzionale
- ✅ Messaggi custom (string o ReactNode)
- ✅ Animazioni fluide
- ✅ Accessibilità (ESC key, backdrop click)

## Props

```typescript
interface ConfirmModalProps {
  isOpen: boolean;              // Stato apertura modal
  onClose: () => void;          // Callback chiusura
  onConfirm: () => void;        // Callback conferma
  title: string;                // Titolo modal
  message: string | ReactNode;  // Messaggio (supporta JSX)
  confirmText?: string;         // Testo bottone conferma (default: "Conferma")
  cancelText?: string;          // Testo bottone annulla (default: "Annulla")
  variant?: 'info' | 'success' | 'warning' | 'danger'; // Tipo (default: "info")
  details?: string[];           // Lista dettagli opzionali
  loading?: boolean;            // Stato loading (default: false)
}
```

## Varianti

### 🔵 Info (default)
Header blu, per azioni informative o conferme generiche.

### 🟢 Success
Header verde, per azioni positive (attivazione, approvazione).

### 🟡 Warning
Header giallo, per azioni che richiedono attenzione.

### 🔴 Danger
Header rosso, per azioni irreversibili (eliminazione, disattivazione).

## Esempi d'Uso

### 1. Eliminazione Semplice

```tsx
import ConfirmModal from '@/components/UI/ConfirmModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  const handleDelete = async () => {
    await deleteItem();
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>Elimina</button>

      <ConfirmModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleDelete}
        title="Elimina Elemento"
        message="Sei sicuro di voler eliminare questo elemento?"
        confirmText="Elimina"
        variant="danger"
      />
    </>
  );
}
```

### 2. Con Dettagli e Loading

```tsx
const [deleting, setDeleting] = useState(false);

const handleDelete = async () => {
  setDeleting(true);
  try {
    await api.delete(itemId);
  } finally {
    setDeleting(false);
  }
};

<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleDelete}
  title="Elimina Annuncio"
  message="Stai per eliminare un annuncio importante."
  confirmText="Elimina"
  variant="danger"
  details={[
    'L\'annuncio sarà rimosso definitivamente',
    'Tutte le statistiche verranno perse',
    'Questa azione non può essere annullata'
  ]}
  loading={deleting}
/>
```

### 3. Con Messaggio Custom JSX

```tsx
<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleAction}
  title="Conferma Operazione"
  message={
    <div>
      <p className="text-gray-900 font-medium mb-2">
        Stai per modificare:
      </p>
      <p className="text-lg font-bold text-gray-900">
        "{itemName}"
      </p>
    </div>
  }
  variant="warning"
/>
```

### 4. Attivazione/Disattivazione

```tsx
<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleToggle}
  title={isActive ? "Disattiva Company" : "Attiva Company"}
  message={`Confermi di voler ${isActive ? 'disattivare' : 'attivare'} questa company?`}
  confirmText={isActive ? "Disattiva" : "Attiva"}
  variant={isActive ? "danger" : "success"}
  details={
    isActive
      ? ['Gli utenti non potranno più accedere', 'Non sarà possibile creare iscrizioni']
      : ['Gli utenti potranno nuovamente accedere', 'Sarà possibile creare iscrizioni']
  }
/>
```

## Pattern Consigliato

```tsx
// 1. Stati
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
const [deleting, setDeleting] = useState(false);

// 2. Handler click
const handleDeleteClick = (item: Item) => {
  setItemToDelete(item);
  setShowDeleteModal(true);
};

// 3. Handler conferma
const handleDeleteConfirm = async () => {
  if (!itemToDelete) return;

  setDeleting(true);
  try {
    await api.delete(itemToDelete.id);
    // Refresh data
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setDeleting(false);
    setShowDeleteModal(false);
    setItemToDelete(null);
  }
};

// 4. JSX
<button onClick={() => handleDeleteClick(item)}>Elimina</button>

<ConfirmModal
  isOpen={showDeleteModal}
  onClose={() => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  }}
  onConfirm={handleDeleteConfirm}
  title="Elimina"
  message={`Confermi eliminazione di "${itemToDelete?.name}"?`}
  variant="danger"
  loading={deleting}
/>
```

## Migrazione da window.confirm

### ❌ Prima (NON fare così)
```tsx
const handleDelete = async () => {
  if (!window.confirm('Sei sicuro?')) return;
  await api.delete(id);
};
```

### ✅ Dopo (fare così)
```tsx
const [showModal, setShowModal] = useState(false);

const handleDelete = async () => {
  await api.delete(id);
  setShowModal(false);
};

<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleDelete}
  title="Conferma Eliminazione"
  message="Sei sicuro di voler procedere?"
  variant="danger"
/>
```

## Note Implementative

- Il modal chiude automaticamente dopo `onConfirm` (non serve chiamare `onClose` manualmente)
- Durante il loading, backdrop e X sono disabilitati
- Supporta ESC key per chiudere (se non loading)
- z-index: 9999 per sovrapposizione garantita
- Animazioni: fade-in + zoom-in-95

## Accessibilità

- ARIA roles: `dialog`, `modal`
- Focus trap durante apertura
- ESC key support
- Click fuori modal per chiudere

## Design System

Colori basati su Tailwind:
- Info: `blue-500` → `indigo-600`
- Success: `green-500` → `green-600`
- Warning: `yellow-500` → `amber-600`
- Danger: `red-500` → `red-600`

Border radius: `rounded-2xl` (16px)
Shadow: `shadow-2xl`
