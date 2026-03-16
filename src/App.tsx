import { useState } from 'react';
// Důležité: Přidáno "type" k DragEndEvent kvůli tvé chybě verbatimModuleSyntax
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import type { Pallet, Truck } from './types';

const SCALE = 0.05; // 1mm = 0.05px (Měřítko pro zobrazení)

// Komponenta pro paletu, se kterou lze hýbat
function DraggablePallet({ pallet }: { pallet: Pallet }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: pallet.id,
  });

  // Vizuální styl palety - kombinuje statickou pozici a dočasný posun (transform)
  const style = {
    width: pallet.width * SCALE,
    height: pallet.height * SCALE,
    left: pallet.position.x * SCALE,
    top: pallet.position.y * SCALE,
    backgroundColor: pallet.color,
    // transform zajistí, že paleta plynule následuje myš během tažení
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="absolute border border-black/20 flex flex-col items-center justify-center shadow-md cursor-move hover:brightness-110 z-10 select-none transition-[background-color]"
    >
      <span className="text-[10px] font-bold text-white drop-shadow-sm uppercase leading-none">
        {pallet.name}
      </span>
      <span className="text-[8px] text-white/90 font-medium">
        {pallet.width}×{pallet.height}
      </span>
    </div>
  );
}

function App() {
  const [truck] = useState<Truck>({ width: 13600, height: 2450 });
  const [pallets, setPallets] = useState<Pallet[]>([
    { id: '1', name: 'EURO 1', width: 1200, height: 800, position: { x: 500, y: 500 }, color: '#16A085' },
    { id: '2', name: 'EURO 2', width: 1200, height: 800, position: { x: 2000, y: 1000 }, color: '#2980B9' },
  ]);

  const handleDragEnd = (event: DragEndEvent) => {
  const { active, delta } = event;
  
  // LOG 1: Koukneme, jestli se funkce vůbec spustí
  console.log("Puštěno! ID:", active.id, "Posun v px:", delta.x, delta.y);

  setPallets((prev) => {
    const newPallets = prev.map((p) => {
      if (p.id === active.id) {
        const newX = p.position.x + delta.x / SCALE;
        const newY = p.position.y + delta.y / SCALE;
        
        // LOG 2: Koukneme na výpočet
        console.log(`Nová pozice pro ${p.name}: [${newX}, ${newY}]`);
        
        return {
          ...p,
          position: { x: newX, y: newY }
        };
      }
      return p;
    });
    return newPallets;
  });
};

  return (
    <div className="min-h-screen bg-slate-900 text-white p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-10 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-blue-400 tracking-tighter">LOGI-PLANER <span className="text-sm font-light text-slate-500">v2.0</span></h1>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mt-1">Status: Vývoj základní mechaniky</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Měřítko 1:{1/SCALE} (1mm = {SCALE}px)
          </div>
        </header>

        {/* DndContext musí obalovat plochu, kde probíhá tahání */}
        <DndContext onDragEnd={handleDragEnd}>
          <div className="bg-slate-800 p-12 rounded-2xl border border-slate-700 shadow-inner flex justify-center items-center overflow-auto">
            <div 
              className="relative bg-slate-200 shadow-inner ring-4 ring-slate-700/50"
              style={{ 
                width: truck.width * SCALE, 
                height: truck.height * SCALE,
                // Mřížka na pozadí kamionu (každých 200mm)
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: `${200 * SCALE}px ${200 * SCALE}px`
              }}
            >
              {/* Vizuální indikátor kabiny */}
              <div className="absolute -right-10 top-0 bottom-0 w-8 bg-red-600 rounded-r-md flex items-center justify-center shadow-lg">
                <span className="[writing-mode:vertical-lr] text-[10px] font-black uppercase text-white tracking-[0.2em]">KABINA</span>
              </div>

              {/* Vykreslení palet */}
              {pallets.map((p) => (
                <DraggablePallet key={p.id} pallet={p} />
              ))}
            </div>
          </div>
        </DndContext>

        <footer className="mt-8 text-slate-600 text-[10px] uppercase tracking-widest text-center">
          Frontend Prototyp • Vite + React + Tailwind + DnD Kit
        </footer>
      </div>
    </div>
  );
}

export default App;