import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { orpc } from '@/utils/orpc'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface InviteUserFormProps {
  projectId: string
  onSuccess: () => void
  onCancel: () => void
}

export function InviteUserForm({ projectId, onSuccess, onCancel }: InviteUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as 'member' | 'admin'
  })

  const inviteUser = useMutation(
    orpc.projects.inviteUser.mutationOptions({
      onMutate: async () => {
        // Show immediate feedback
        toast.success(`Sending invitation to ${formData.email}...`)
      },
      onSuccess: (result) => {
        toast.success(`Invitation sent successfully to ${formData.email}`)
        onSuccess()
        setFormData({ email: '', role: 'member' })
      },
      onError: (error: any) => {
        toast.error(`Failed to send invitation: ${error.message}`)
      }
    })
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    inviteUser.mutate({
      projectId,
      email: formData.email.trim(),
      role: formData.role
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email Address</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="user@example.com"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: 'member' | 'admin') =>
            setFormData(prev => ({ ...prev, role: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Members can view and work on tasks. Admins have additional management permissions.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={inviteUser.isPending}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={inviteUser.isPending}
        >
          {inviteUser.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Invitation'
          )}
        </Button>
      </div>
    </form>
  )
}