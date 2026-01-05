'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createProject, updateProject } from '@/app/actions/projects'
import { projectSchema, type ProjectFormData, projectColors } from '@/lib/validations'
import type { Project } from '@/types/database'

interface ProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  onSuccess?: () => void
}

export function ProjectModal({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ProjectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(
    project?.color || projectColors[0].value
  )

  const isEditing = !!project

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name || '',
      color: project?.color || projectColors[0].value,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: project?.name || '',
        color: project?.color || projectColors[0].value,
      })
      setSelectedColor(project?.color || projectColors[0].value)
    }
  }, [open, project, reset])

  const onSubmit = async (data: ProjectFormData) => {
    setIsLoading(true)
    try {
      if (isEditing) {
        const { error } = await updateProject(project.id, {
          name: data.name,
          color: selectedColor,
        })

        if (error) {
          toast.error(error)
          return
        }
        toast.success('Project updated!')
      } else {
        const { error } = await createProject({
          name: data.name,
          color: selectedColor,
        })

        if (error) {
          toast.error(error)
          return
        }
        toast.success('Project created!')
      }

      onOpenChange(false)
      onSuccess?.()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="Enter project name"
              {...register('name')}
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {projectColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    selectedColor === color.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Project'
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
