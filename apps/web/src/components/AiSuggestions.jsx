
import React, { useState } from 'react';
import IntegratedAiChat from '@/components/integrated-ai-chat.jsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function AiSuggestions() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg p-0">
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 h-[100dvh]">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Assistente Clareia
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden relative">
          <IntegratedAiChat />
        </div>
      </SheetContent>
    </Sheet>
  );
}
