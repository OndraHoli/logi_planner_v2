import { useState } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragOverlay, 
  type DragStartEvent, 
  type DragEndEvent 
} from '@dnd-kit/core';
import type { Pallet, Truck } from './types';


const SCALE = 0.085;
// PŘIDÁNO: Síla magnetu na hranách (v pixelech). Jak daleko musíš táhnout ven, aby se paleta utrhla.
const ESCAPE_THRESHOLD_PX = 80; 

const PALLET_TEMPLATES = [
  { id: 'euro', name: 'EURO', width: 1200, height: 800, color: '#16A085' },
  { id: 'ind', name: 'Průmyslová', width: 1200, height: 1000, color: '#8E44AD' },
  { id: 'half', name: 'Poloviční', width: 800, height: 600, color: '#D35400' },
  { id: 'ibc', name: 'IBC Nádrž', width: 1200, height: 1000, color: '#2980B9' },
  { id: 'gitter', name: 'Gitterbox', width: 1240, height: 835, color: '#7f8c8d' },
];

const TRUCK_TYPES = [
  { id: 'semi', name: 'Návěs (13.6m)', width: 13600, height: 2450 },
  { id: 'tandem', name: 'Tandem/Přívěs (7.7m)', width: 7700, height: 2450 },
  { id: 'solo', name: 'Sólo 12t (7.2m)', width: 7200, height: 2450 },
  { id: 'van_box', name: 'Dodávka Plachta (4.2m)', width: 4200, height: 2100 },
  { id: 'van_small', name: 'Dodávka Plechovka (3.3m)', width: 3300, height: 1750 },
];

function TemplateItem({ template }: { template: typeof PALLET_TEMPLATES[0] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tpl-${template.id}`,
    data: { isTemplate: true, ...template }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center justify-center cursor-grab transition-all hover:scale-105 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div 
        className="border-2 border-black/30 shadow-md rounded-sm flex items-center justify-center mb-2"
        style={{ 
          backgroundColor: template.color, 
          width: template.width * SCALE, 
          height: template.height * SCALE 
        }}
      >
        <span className="text-[10px] font-black text-white uppercase drop-shadow-md text-center leading-tight">
          {template.name}
        </span>
      </div>
      <span className="text-[10px] text-slate-400 font-medium">
        {template.width}×{template.height}
      </span>
    </div>
  );
}

interface DraggablePalletProps {
  pallet: Pallet;
  truck: Truck; // PŘIDÁNO: Paleta musí znát rozměry auta, aby věděla, kde je zeď
  onRemove: (id: string) => void;
}

function DraggablePallet({ pallet, truck, onRemove }: DraggablePalletProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(pallet.id),
    data: { isTemplate: false }
  });

  // 1. Zjistíme surovou pozici kurzoru
  let rawX = (pallet.position.x * SCALE) + (transform ? transform.x : 0);
  let rawY = (pallet.position.y * SCALE) + (transform ? transform.y : 0);

  // 2. Vypočítáme, kde přesně jsou pravé a spodní stěny kamionu
  const maxX = (truck.width - pallet.width) * SCALE;
  const maxY = (truck.height - pallet.height) * SCALE;

  // 3. MAGNETICKÁ LOGIKA (Osa X)
  // Pokud jsme za stěnou (v mínusu), ale neutrhli jsme to o víc než 80px, přilepíme to na nulu
  if (rawX < 0 && rawX >= -ESCAPE_THRESHOLD_PX) {
    rawX = 0;
  } 
  // Pokud jsme za pravou stěnou, ale neutrhli jsme to, přilepíme to na pravou stěnu
  else if (rawX > maxX && rawX <= maxX + ESCAPE_THRESHOLD_PX) {
    rawX = maxX;
  }

  // 4. MAGNETICKÁ LOGIKA (Osa Y) - Platí to samé pro horní a spodní stěnu
  if (rawY < 0 && rawY >= -ESCAPE_THRESHOLD_PX) {
    rawY = 0;
  } else if (rawY > maxY && rawY <= maxY + ESCAPE_THRESHOLD_PX) {
    rawY = maxY;
  }

  const style = {
    width: pallet.width * SCALE,
    height: pallet.height * SCALE,
    left: 0,
    top: 0,
    transform: `translate3d(${rawX}px, ${rawY}px, 0)`,
    backgroundColor: pallet.color,
    zIndex: isDragging ? 50 : 10,
    boxShadow: isDragging ? '0 20px 25px -5px rgb(0 0 0 / 0.5)' : '0 4px 6px -1px rgb(0 0 0 / 0.3)',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group absolute border-2 border-black/20 flex flex-col items-center justify-center cursor-move transition-[box-shadow,opacity] rounded-sm"
    >
      <span className="text-[10px] font-black text-white uppercase drop-shadow-md leading-none tracking-wider pointer-events-none">
        {pallet.name}
      </span>
      <span className="text-[8px] text-white/90 font-bold mt-0.5 pointer-events-none">
        {pallet.width}×{pallet.height}
      </span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(pallet.id)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 cursor-pointer border border-white/20"
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  const [truck, setTruck] = useState<Truck>(TRUCK_TYPES[0]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);

  const { setNodeRef: setTruckRef } = useDroppable({ id: 'truck-board' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.isTemplate) {
      setActiveTemplate(active.data.current);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveTemplate(null);

    // Převedeme odtrhávací hranici z pixelů na milimetry pro uložení do paměti
    const THRESHOLD_MM = ESCAPE_THRESHOLD_PX / SCALE;

    // A) VLOŽENÍ ŠABLONY Z MENU
    if (active.data.current?.isTemplate) {
      const truckEl = document.getElementById('truck-board');
      if (!truckEl) return;

      const truckRect = truckEl.getBoundingClientRect();
      const itemRect = active.rect.current.translated;

      if (itemRect) {
        const itemWidth = active.data.current.width * SCALE;
        const itemHeight = active.data.current.height * SCALE;
        const centerX = itemRect.left + itemWidth / 2;
        const centerY = itemRect.top + itemHeight / 2;

        if (
          centerX >= truckRect.left &&
          centerX <= truckRect.right &&
          centerY >= truckRect.top &&
          centerY <= truckRect.bottom
        ) {
          let dropX = (itemRect.left - truckRect.left) / SCALE;
          let dropY = (itemRect.top - truckRect.top) / SCALE;

          // Aplikujeme magnet i při vkládání z menu
          const maxX_mm = truck.width - active.data.current.width;
          const maxY_mm = truck.height - active.data.current.height;

          if (dropX < 0 && dropX >= -THRESHOLD_MM) dropX = 0;
          else if (dropX > maxX_mm && dropX <= maxX_mm + THRESHOLD_MM) dropX = maxX_mm;

          if (dropY < 0 && dropY >= -THRESHOLD_MM) dropY = 0;
          else if (dropY > maxY_mm && dropY <= maxY_mm + THRESHOLD_MM) dropY = maxY_mm;

          const newPallet: Pallet = {
            id: Date.now().toString(),
            name: active.data.current.name,
            width: active.data.current.width,
            height: active.data.current.height,
            color: active.data.current.color,
            position: { x: dropX, y: dropY },
          };
          setPallets((prev) => [...prev, newPallet]);
        }
      }
      return;
    }

    // B) TAHÁNÍ EXISTUJÍCÍ PALETY PO KAMIONU A VEN Z NĚJ
    setPallets((prev) => 
      prev.map((p) => {
        if (String(p.id) === String(active.id)) {
          let newX = p.position.x + (delta.x / SCALE);
          let newY = p.position.y + (delta.y / SCALE);

          const maxX_mm = truck.width - p.width;
          const maxY_mm = truck.height - p.height;

          // Magnetické uložení pro osu X
          if (newX < 0 && newX >= -THRESHOLD_MM) newX = 0;
          else if (newX > maxX_mm && newX <= maxX_mm + THRESHOLD_MM) newX = maxX_mm;

          // Magnetické uložení pro osu Y
          if (newY < 0 && newY >= -THRESHOLD_MM) newY = 0;
          else if (newY > maxY_mm && newY <= maxY_mm + THRESHOLD_MM) newY = maxY_mm;

          return { ...p, position: { x: newX, y: newY } };
        }
        return p;
      })
    );
  };

  const removePallet = (idToRemove: string) => {
    setPallets((prev) => prev.filter((p) => p.id !== idToRemove));
  };

  const handleTruckChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedTruck = TRUCK_TYPES.find(t => t.id === selectedId);
    if (selectedTruck) {
      setTruck({ width: selectedTruck.width, height: selectedTruck.height });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col selection:bg-blue-500/30">
      <header className="bg-slate-950 border-b border-slate-800 px-8 py-5 flex justify-between items-center shadow-lg z-20 relative">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-xl font-black text-white">L</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight leading-none">
              LOGI-PLANER <span className="text-blue-500">v2.0</span>
            </h1>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        
        <div className="bg-slate-900 border-b border-slate-700 p-6 flex justify-center flex-wrap gap-8 shadow-2xl relative z-10">
          {PALLET_TEMPLATES.map(tpl => (
            <TemplateItem key={tpl.id} template={tpl} />
          ))}
        </div>

        <main className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 overflow-visible">
          <div className="bg-slate-800/80 py-10 pr-10 pl-24 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-sm flex flex-col items-center transition-all duration-300">
            
            <div className="w-full flex justify-between items-end mb-6 -ml-14">
              <div className="flex items-center gap-4">
                <span className="text-slate-400 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  Typ vozu:
                </span>
                
                <select 
                  onChange={handleTruckChange}
                  className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none shadow-inner cursor-pointer"
                >
                  {TRUCK_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.width} × {t.height} mm)
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-400 text-sm font-semibold bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                Naloženo: <span className="text-white font-black">{pallets.length}</span> ks
              </span>
            </div>

            <div 
              id="truck-board"
              ref={setTruckRef}
              className="relative bg-slate-200 shadow-inner rounded-r-md ring-8 ring-slate-700 pointer-events-auto overflow-visible transition-all duration-500 ease-in-out"
              style={{ 
                width: truck.width * SCALE, 
                height: truck.height * SCALE,
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: `${200 * SCALE}px ${200 * SCALE}px`,
              }}
            >
              <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-14 h-24 bg-red-600 rounded-l-2xl shadow-[-10px_0_20px_rgba(0,0,0,0.3)] border-y-4 border-l-4 border-red-700 flex items-center justify-center z-0 pointer-events-none">
                <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-black uppercase text-red-200 tracking-[0.3em]">
                  KABINA
                </span>
              </div>

              <div className="absolute inset-0 overflow-visible pointer-events-none">
                {pallets.map((p) => (
                  <div key={p.id} className="pointer-events-auto inline-block transition-all duration-300">
                    {/* ZDE PŘEDÁVÁME TRUCK DO PALETY */}
                    <DraggablePallet pallet={p} truck={truck} onRemove={removePallet} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>

        <DragOverlay dropAnimation={null}>
          {activeTemplate ? (
            <div
              className="border-2 border-white/50 shadow-2xl flex items-center justify-center cursor-grabbing opacity-90 pointer-events-none"
              style={{
                backgroundColor: activeTemplate.color,
                width: activeTemplate.width * SCALE,
                height: activeTemplate.height * SCALE,
              }}
            >
              <span className="text-[10px] font-black text-white uppercase drop-shadow-md text-center leading-tight">
                {activeTemplate.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>

      </DndContext>
    </div>
  );
}

export default App;