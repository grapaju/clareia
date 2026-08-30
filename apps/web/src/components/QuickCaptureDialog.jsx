import React, { useEffect, useState } from 'react';
import { NotebookPen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { createUnsortedNote, removeUnsortedNote } from '@/lib/unsortedNotesStorage.js';
import { hasActionableCapture } from '@/lib/unloadMindLogic.js';
import apiClient, { getCurrentAccountId } from '@/lib/apiClient.js';
import { createOrReusePlanDraft } from '@/services/planDraftService.js';

export default function QuickCaptureDialog({ triggerLabel = 'Tirar da cabeça' }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || apiClient.authStore?.model?.id || '';
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();
  const draftKey = `clareia_quick_capture_draft_${userId || 'anonymous'}`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    setText(window.localStorage.getItem(draftKey) || '');
  }, [draftKey, open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    if (text.trim()) window.localStorage.setItem(draftKey, text);
    else window.localStorage.removeItem(draftKey);
  }, [draftKey, open, text]);

  const clearAndClose = () => {
    setText('');
    window.localStorage.removeItem(draftKey);
    setOpen(false);
  };

  const handleSaveForLater = () => {
    const note = createUnsortedNote({ content: text, userId, source: 'captura-rapida' });
    if (!note) return;
    clearAndClose();
    toast.success('Guardado para você revisar depois.', {
      action: { label: 'Ver guardado', onClick: () => navigate('/guardados') },
      cancel: { label: 'Desfazer', onClick: () => removeUnsortedNote(note.id, userId) },
    });
  };

  const handleOrganize = async () => {
    const content = text.trim();
    if (!content || isProcessing) return;

    if (!hasActionableCapture(content)) {
      handleSaveForLater();
      toast.info('Ainda não parece uma ação clara, então guardamos para você decidir depois.');
      return;
    }

    setIsProcessing(true);
    try {
      const record = await createOrReusePlanDraft({
        text: content,
        userId,
        accountId,
        origin: 'captura-rapida',
      });

      clearAndClose();
      navigate('/plano-clareado', { state: { planRecord: record } });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível organizar agora. Seu texto continua aqui.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="min-h-11">
          <NotebookPen className="h-4 w-4 sm:mr-2" aria-hidden="true" />
          <span className={triggerLabel === 'Tirar da cabeça' ? 'hidden sm:inline' : ''}>{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tirar da cabeça</DialogTitle>
          <DialogDescription>
            Escreva antes que você esqueça. Pode ser uma ou várias coisas.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ex.: acompanhar Google Ads da Corcril, cobrar fatura do IDT-PR"
          className="min-h-40 resize-y text-base"
        />
        <p className="text-xs text-muted-foreground">O rascunho é salvo enquanto você escreve.</p>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={handleSaveForLater} disabled={!text.trim() || isProcessing}>
            Guardar para depois
          </Button>
          <Button onClick={handleOrganize} disabled={!text.trim() || isProcessing}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            {isProcessing ? 'Organizando...' : 'Organizar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}