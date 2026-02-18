"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CreateTripCard from "./create-trip-card";

export interface CreateTripDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  children: React.ReactNode;
}

export default function CreateTripDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
  children,
}: CreateTripDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled =
    controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen! : internalOpen;
  const onOpenChange = isControlled
    ? controlledOnOpenChange!
    : setInternalOpen;

  return (
    <>
      {showTrigger && (
        <CreateTripCard onClick={() => onOpenChange(true)} />
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new trip</DialogTitle>
            <DialogDescription>
              Give it a name — you can add details later.
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
