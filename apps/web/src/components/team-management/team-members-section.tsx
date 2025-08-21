import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCacheUtils } from '@/hooks/use-cache-utils'
import { orpc } from '@/utils/orpc'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Users, Mail, Shield, UserMinus, Crown, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InviteUserForm } from './invite-user-form'

interface TeamMembersSectionProps {
  projectId: string
}

interface Member {
  user: {
    id: string
    email: string
    displayName: string
  }
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

interface Invitation {
  invitation: {
    id: string
    email: string
    role: 'admin' | 'member'
    status: 'pending'
    expiresAt: string
    createdAt: string
  }
  invitedByUser: {
    id: string
    displayName: string
  }
}

function MemberCard({ member, currentUserId, onRemove, isRemoving }: {
  member: Member
  currentUserId: string
  onRemove: (userId: string) => void
  isRemoving?: boolean
}) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-600" />
      case 'admin':
        return <Shield className="h-3 w-3 text-blue-600" />
      default:
        return <Users className="h-3 w-3 text-gray-600" />
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">Owner</Badge>
      case 'admin':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Admin</Badge>
      default:
        return <Badge variant="outline">Member</Badge>
    }
  }

  const canRemove = member.user.id !== currentUserId && member.role !== 'owner'

  return (
    <Card className={cn("mb-3", isRemoving && "opacity-60")}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getRoleIcon(member.role)}
              <h4 className="font-medium text-sm">{member.user.displayName}</h4>
              {getRoleBadge(member.role)}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {member.user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </p>
          </div>
          {canRemove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(member.user.id)}
              disabled={isRemoving}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              {isRemoving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserMinus className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function InvitationCard({ invitation, onRevoke, isRevoking }: {
  invitation: Invitation
  onRevoke: (invitationId: string) => void
  isRevoking?: boolean
}) {
  const isExpired = new Date() > new Date(invitation.invitation.expiresAt)
  
  return (
    <Card className={cn("mb-3", (isExpired || isRevoking) && "opacity-60")}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <h4 className="font-medium text-sm">{invitation.invitation.email}</h4>
              <Badge variant={isExpired ? "destructive" : "secondary"} className="text-xs">
                {isExpired ? "Expired" : "Pending"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Role: {invitation.invitation.role}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? 
                `Expired ${new Date(invitation.invitation.expiresAt).toLocaleDateString()}` :
                `Expires ${new Date(invitation.invitation.expiresAt).toLocaleDateString()}`
              }
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRevoke(invitation.invitation.id)}
            disabled={isRevoking}
            className="h-8 px-3 text-destructive hover:text-destructive text-xs"
          >
            {isRevoking ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Revoking...
              </>
            ) : (
              'Revoke'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function TeamMembersSection({ projectId }: TeamMembersSectionProps) {
  const cache = useCacheUtils()
  const [showInviteForm, setShowInviteForm] = useState(false)

  // Fetch current members
  const { data: members, isLoading: loadingMembers } = useQuery(
    orpc.projects.getMembers.queryOptions({
      input: { id: projectId }
    })
  )

  // Fetch pending invitations
  const { data: invitations, isLoading: loadingInvitations } = useQuery(
    orpc.projects.getInvitations.queryOptions({
      input: { id: projectId }
    })
  )

  // Remove member mutation with optimistic update
  const removeMember = useMutation(
    orpc.projects.removeMember.mutationOptions({
      onMutate: async ({ userId }) => {
        // Cancel any outgoing refetches
        await cache.cancelQueries(cache.queryKeys.projects.detail(projectId))
        
        // Optimistically update the UI
        const previousMembers = members
        // We'll let the UI handle the optimistic state through loading states
        return { previousMembers }
      },
      onSuccess: () => {
        toast.success('Member removed successfully')
        // Invalidate and refetch
        cache.invalidateProjectLists()
      },
      onError: (error: any, variables, context) => {
        toast.error(`Failed to remove member: ${error.message}`)
        // Restore the previous state if we had one
        if (context?.previousMembers) {
          cache.invalidateProjectLists()
        }
      },
      onSettled: () => {
        // Always refetch after mutation
        cache.invalidateProjectLists()
      }
    })
  )

  // Revoke invitation mutation with optimistic update
  const revokeInvitation = useMutation(
    orpc.projects.revokeInvitation.mutationOptions({
      onMutate: async ({ invitationId }) => {
        // Cancel any outgoing refetches
        await cache.cancelQueries(cache.queryKeys.projects.detail(projectId))
        
        // Store previous state
        const previousInvitations = invitations
        return { previousInvitations }
      },
      onSuccess: () => {
        toast.success('Invitation revoked successfully')
        cache.invalidateProjectLists()
      },
      onError: (error: any, variables, context) => {
        toast.error(`Failed to revoke invitation: ${error.message}`)
        if (context?.previousInvitations) {
          cache.invalidateProjectLists()
        }
      },
      onSettled: () => {
        cache.invalidateProjectLists()
      }
    })
  )

  const handleRemoveMember = (userId: string) => {
    if (window.confirm('Are you sure you want to remove this member from the project?')) {
      removeMember.mutate({ projectId, userId })
    }
  }

  const handleRevokeInvitation = (invitationId: string) => {
    if (window.confirm('Are you sure you want to revoke this invitation?')) {
      revokeInvitation.mutate({ invitationId })
    }
  }

  const handleInviteSuccess = () => {
    setShowInviteForm(false)
    cache.invalidateProjectLists()
  }

  // Find current user by role (owner or from first member)
  const currentUser = members?.find((member: any) => member.role === 'owner') || members?.[0]
  const currentUserId = currentUser?.user?.id || ''

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Team Management</h3>
          <Button 
            size="sm" 
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Invite User
          </Button>
        </div>

        {/* Invite User Form */}
        {showInviteForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Invite New Member</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteUserForm 
                projectId={projectId}
                onSuccess={handleInviteSuccess}
                onCancel={() => setShowInviteForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {/* Current Members Section */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Current Members
            {members && <Badge variant="outline">{members.length}</Badge>}
          </h4>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading members...</span>
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member: any) => (
                <MemberCard
                  key={member.user.id}
                  member={member}
                  currentUserId={currentUserId}
                  onRemove={handleRemoveMember}
                  isRemoving={removeMember.isPending}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No team members</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Pending Invitations Section */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Pending Invitations
            {invitations && <Badge variant="outline">{invitations.length}</Badge>}
          </h4>

          {loadingInvitations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading invitations...</span>
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="space-y-3">
              {invitations.map((invitation: any) => (
                <InvitationCard
                  key={invitation.invitation.id}
                  invitation={invitation}
                  onRevoke={handleRevokeInvitation}
                  isRevoking={revokeInvitation.isPending}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending invitations</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}