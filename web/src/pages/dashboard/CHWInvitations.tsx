import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { getMyInvitations, respondToInvitation } from "@/services/cehoGroup.service";
import { ICEHOGroupInvitation } from "@/types";
import { Button } from "@/components/common/Button";

const UserAvatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const [failed, setFailed] = useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? "??";
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[#EBF0F9] text-[#3363AD] flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
};

const CHWInvitationsPage = () => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{
    invitation: ICEHOGroupInvitation;
    accept: boolean;
  } | null>(null);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["chw-my-invitations"],
    queryFn: getMyInvitations,
  });

  const { mutate: respond, isPending } = useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      respondToInvitation(invitationId, accept),
    onSuccess: (_, { accept }) => {
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ["chw-my-invitations"] });
      toast.success(accept ? "Invitation accepted! You have joined the group." : "Invitation declined.");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? "Failed to respond to invitation.";
      toast.error(msg);
    },
  });

  const confirmRespond = () => {
    if (pendingAction) {
      respond({ invitationId: pendingAction.invitation.id, accept: pendingAction.accept });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-3xl font-bold text-[#333333]">Group Invitations</h2>
        <p className="text-sm text-gray-500">
          Review and respond to invitations from Community Health Officers.
        </p>
      </div>

      {/* States */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF0F9] flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#3363AD]/40" />
          </div>
          <p className="text-gray-600 font-semibold">No pending invitations</p>
          <p className="text-gray-400 text-sm">
            When a CEHO invites you to their group, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => {
            const ceho = inv.group?.ceho?.user;
            const groupName = inv.group?.name ?? "Unknown Group";
            const invitedAt = new Date(inv.invitedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={inv.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Group icon */}
                <div className="w-12 h-12 rounded-xl bg-[#EBF0F9] flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-[#3363AD]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{groupName}</p>
                  {ceho && (
                    <div className="flex items-center gap-2 mt-1">
                      <UserAvatar name={ceho.fullNames} photo={ceho.photo} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 font-medium truncate">{ceho.fullNames}</p>
                        {ceho.phoneNumber && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />
                            <span>{ceho.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Invited {invitedAt}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => setPendingAction({ invitation: inv, accept: false })}
                    className="text-red-600 hover:bg-red-50 border-red-200"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => setPendingAction({ invitation: inv, accept: true })}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Accept
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal */}
      <Transition appear show={!!pendingAction} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isPending && setPendingAction(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      pendingAction?.accept ? "bg-emerald-50" : "bg-red-50"
                    }`}
                  >
                    {pendingAction?.accept ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      {pendingAction?.accept ? "Accept Invitation" : "Decline Invitation"}
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-1">
                      {pendingAction?.accept
                        ? `Join ${pendingAction?.invitation.group?.name ?? "this group"}?`
                        : `Decline the invitation from ${pendingAction?.invitation.group?.name ?? "this group"}?`}
                    </Dialog.Description>
                  </div>

                  {pendingAction?.accept && (
                    <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3 text-left text-xs text-amber-700">
                      Accepting will add you as a member. You can only belong to one group.
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPendingAction(null)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className={`flex-1 ${!pendingAction?.accept ? "!bg-red-600 hover:!bg-red-700" : ""}`}
                    onClick={confirmRespond}
                    isLoading={isPending}
                  >
                    {!isPending && (
                      pendingAction?.accept
                        ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        : <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {pendingAction?.accept ? "Accept" : "Decline"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default CHWInvitationsPage;
