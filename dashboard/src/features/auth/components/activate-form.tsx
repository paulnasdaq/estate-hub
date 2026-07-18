import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useActivate } from "../api/auth.queries";
import { activateFormSchema, type ActivateFormValues } from "../schemas";

// Presentational + mutation logic only. `token` comes from the activation link;
// the parent supplies it and decides what happens after activation via
// `onSuccess`, keeping this component testable without a router.
export function ActivateForm({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: () => void;
}) {
  const activate = useActivate();

  const form = useForm<ActivateFormValues>({
    resolver: zodResolver(activateFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ActivateFormValues) {
    try {
      await activate.mutateAsync({ token, password: values.password });
      toast.success("Your account is ready");
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={activate.isPending}>
          {activate.isPending ? "Activating…" : "Set password & continue"}
        </Button>
      </form>
    </Form>
  );
}
