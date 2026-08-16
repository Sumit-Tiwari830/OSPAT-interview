import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

/**
 * Mutation hook for updating session settings (e.g. toggleing fullscreenRequired).
 * Usage: const { mutate } = useUpdateSessionSettings();
 *        mutate({ id: session._id, settings: { fullscreenRequired: true } });
 */
export function useUpdateSessionSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, settings }) =>
            axiosInstance.patch(`/sessions/${id}/settings`, settings).then((r) => r.data),
        onSuccess: (_data, variables) => {
            // Invalidate so SessionPage re-fetches with the updated fullscreenRequired flag
            queryClient.invalidateQueries({ queryKey: ["session", variables.id] });
        },
    });
}
