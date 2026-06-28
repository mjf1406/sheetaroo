import { useMutation } from 'convex/react'
import { ChevronDown, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type SavedDictation = {
  _id: Id<'dictations'>
  name: string
  createdAt: number
  audioUrl: string | null
}

type SavedDictationsProps = {
  dictations: SavedDictation[]
}

export function SavedDictations({ dictations }: SavedDictationsProps) {
  const removeDictation = useMutation(api.dictations.remove)

  if (dictations.length === 0) {
    return null
  }

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="group cursor-pointer select-none hover:bg-muted/50">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Saved dictations ({dictations.length})</CardTitle>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {dictations.map((dictation) => (
              <div
                key={dictation._id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{dictation.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(dictation.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {dictation.audioUrl ? (
                    <>
                      <audio controls src={dictation.audioUrl} className="h-8 max-w-xs" />
                      <Button size="sm" variant="outline" asChild>
                        <a href={dictation.audioUrl} download={`${dictation.name}.wav`}>
                          Download
                        </a>
                      </Button>
                    </>
                  ) : null}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" aria-label={`Delete ${dictation.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete dictation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{dictation.name}&quot;. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void removeDictation({ id: dictation._id })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
