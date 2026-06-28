import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { WORKSHEET_LABELS, type WorksheetId } from '@/lib/vocabulary-types'

type WorksheetChecklistProps = {
  checked: Record<WorksheetId, boolean>
  order: WorksheetId[]
  onCheckedChange: (id: WorksheetId, value: boolean) => void
  onOrderChange: (order: WorksheetId[]) => void
}

type SortableWorksheetRowProps = {
  id: WorksheetId
  checked: boolean
  onCheckedChange: (id: WorksheetId, value: boolean) => void
}

function SortableWorksheetRow({ id, checked, onCheckedChange }: SortableWorksheetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-transparent bg-background p-1"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${WORKSHEET_LABELS[id]}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        id={`worksheet-${id}`}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(id, value === true)}
      />
      <Label htmlFor={`worksheet-${id}`} className="cursor-pointer flex-1 font-normal">
        {WORKSHEET_LABELS[id]}
      </Label>
    </div>
  )
}

export function WorksheetChecklist({
  checked,
  order,
  onCheckedChange,
  onOrderChange,
}: WorksheetChecklistProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = order.indexOf(active.id as WorksheetId)
    const newIndex = order.indexOf(over.id as WorksheetId)
    if (oldIndex === -1 || newIndex === -1) return

    onOrderChange(arrayMove(order, oldIndex, newIndex))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worksheets</CardTitle>
        <CardDescription>
          Choose which worksheets to show below. Drag to reorder sections in the preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((id) => (
                <SortableWorksheetRow
                  key={id}
                  id={id}
                  checked={checked[id]}
                  onCheckedChange={onCheckedChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  )
}
