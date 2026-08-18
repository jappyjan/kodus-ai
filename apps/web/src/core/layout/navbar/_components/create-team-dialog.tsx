"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTeam } from "@services/teams/fetch";
import { PlusIcon } from "lucide-react";
import { Button } from "src/core/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "src/core/components/ui/dialog";
import { Input } from "src/core/components/ui/input";
import { Label } from "src/core/components/ui/label";
import { toast } from "src/core/components/ui/toaster/use-toast";
import { useSelectedTeamId } from "src/core/providers/selected-team-context";
import { revalidateServerSideTag } from "src/core/utils/revalidate-server-side";

const ERROR_MESSAGES: Record<string, string> = {
    "api.team.team_name_already_exists":
        "A workspace with this name already exists.",
};

const MAX_TEAM_NAME_LENGTH = 100;

type CreateTeamDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function CreateTeamDialog({
    open,
    onOpenChange,
}: CreateTeamDialogProps) {
    const router = useRouter();
    const { setTeamId } = useSelectedTeamId();

    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOpenChange = (nextOpen: boolean) => {
        if (isSubmitting) return;
        onOpenChange(nextOpen);
        if (!nextOpen) setName("");
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const teamName = name.trim();
        if (!teamName || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const result = await createTeam(teamName);

            if ("error" in result) {
                const errorKey = String(result.error);
                toast({
                    variant: "danger",
                    description:
                        ERROR_MESSAGES[errorKey] ??
                        "Failed to create workspace. Please try again.",
                });
                return;
            }

            const newTeam = result.data;

            handleOpenChange(false);

            toast({
                variant: "success",
                description: (
                    <span>
                        Workspace{" "}
                        <span className="text-primary-light font-bold">
                            {newTeam.name}
                        </span>{" "}
                        created. Connect its GitHub organization to start
                        reviewing.
                    </span>
                ),
            });

            // Refresh the server-side team list, select the new team and go
            // straight to its onboarding (finishOnboard is false, so the app
            // layout would redirect to /setup anyway — going directly to the
            // git-connection step avoids the per-user "last step" cookie
            // jumping to a stale step from the previous team's onboarding).
            await revalidateServerSideTag("teams-list");
            setTeamId(newTeam.uuid);
            router.push("/setup/connecting-git-tool");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create workspace</DialogTitle>
                    <DialogDescription>
                        Each workspace connects its own GitHub organization, so
                        you can review PRs across multiple orgs from this Kodus
                        instance.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="new-team-name">Workspace name</Label>
                        <Input
                            id="new-team-name"
                            value={name}
                            onChange={(event) =>
                                setName(
                                    event.target.value.slice(
                                        0,
                                        MAX_TEAM_NAME_LENGTH,
                                    ),
                                )
                            }
                            placeholder="e.g. my-other-org"
                            autoFocus
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            size="md"
                            variant="cancel"
                            disabled={isSubmitting}
                            onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="md"
                            variant="primary"
                            leftIcon={<PlusIcon />}
                            loading={isSubmitting}
                            disabled={!name.trim() || isSubmitting}>
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
