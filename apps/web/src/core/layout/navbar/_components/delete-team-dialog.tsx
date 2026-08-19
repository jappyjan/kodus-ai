"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTeam } from "@services/teams/fetch";
import { TrashIcon } from "lucide-react";
import { Button } from "src/core/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "src/core/components/ui/dialog";
import { Label } from "src/core/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "src/core/components/ui/select";
import { toast } from "src/core/components/ui/toaster/use-toast";
import { useAllTeams } from "src/core/providers/all-teams-context";
import { useSelectedTeamId } from "src/core/providers/selected-team-context";
import { revalidateServerSideTag } from "src/core/utils/revalidate-server-side";

const ERROR_MESSAGES: Record<string, string> = {
    "api.team.not_found": "Workspace not found.",
    "api.team.cannot_delete_last_team":
        "You cannot delete your only workspace.",
};

type DeleteTeamDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteTeamDialog({
    open,
    onOpenChange,
}: DeleteTeamDialogProps) {
    const router = useRouter();
    const { teams } = useAllTeams();
    const { teamId: selectedTeamId, setTeamId } = useSelectedTeamId();

    const [teamToDelete, setTeamToDelete] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleOpenChange = (nextOpen: boolean) => {
        if (isDeleting) return;
        onOpenChange(nextOpen);
        if (!nextOpen) setTeamToDelete("");
    };

    const handleDelete = async () => {
        if (!teamToDelete || isDeleting) return;

        setIsDeleting(true);

        try {
            const result = await deleteTeam(teamToDelete);

            if ("error" in result) {
                const errorKey = String(result.error);
                toast({
                    variant: "danger",
                    description:
                        ERROR_MESSAGES[errorKey] ??
                        "Failed to delete workspace. Please try again.",
                });
                return;
            }

            const deletedTeam = teams.find((t) => t.uuid === teamToDelete);
            const remainingTeams = teams.filter((t) => t.uuid !== teamToDelete);

            handleOpenChange(false);

            toast({
                variant: "success",
                description: (
                    <span>
                        Workspace{" "}
                        <span className="text-primary-light font-bold">
                            {deletedTeam?.name ?? "deleted"}
                        </span>{" "}
                        was removed.
                    </span>
                ),
            });

            await revalidateServerSideTag("teams-list");

            if (selectedTeamId === teamToDelete && remainingTeams.length) {
                setTeamId(remainingTeams[0].uuid);
            }

            router.refresh();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete workspace</DialogTitle>
                    <DialogDescription>
                        Deleting a workspace disconnects its GitHub organization
                        and removes it from your account. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="delete-team-select">Workspace</Label>
                    <Select
                        value={teamToDelete}
                        onValueChange={setTeamToDelete}
                        disabled={isDeleting}>
                        <SelectTrigger id="delete-team-select">
                            <SelectValue placeholder="Select a workspace" />
                        </SelectTrigger>
                        <SelectContent>
                            {teams.map((team) => (
                                <SelectItem key={team.uuid} value={team.uuid}>
                                    {team.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        size="md"
                        variant="cancel"
                        disabled={isDeleting}
                        onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="md"
                        variant="error"
                        leftIcon={<TrashIcon />}
                        loading={isDeleting}
                        disabled={!teamToDelete || isDeleting}
                        onClick={handleDelete}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
