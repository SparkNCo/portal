"use client";
import React from "react";

import { Formik } from "formik";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Info,
  LoaderCircle,
  Send,
  SendIcon,
} from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { AnimatePresence, motion } from "framer-motion";
import { Progress } from "../progress";
import { DynamicField } from "../form/dynamic-field";
import { DynamicFieldType, LayoutType } from "@/lib/types/utils/form";
import { getInitialValues } from "./utils/functions";
import { toast } from "sonner";
import ProgressStepper from "./components/stepper";
import { getURL } from "@/components/components/ui/form/utils/helpers";
import { Button } from "@/components/components/ui/button";

export type ErrorSuccessResponseMessage = {
  error: string | null;
  success: string | null;
};

type Props = {
  layout: LayoutType;
  lang: "fr" | "en";
  saveFn?: (formData: FormData) => Promise<ErrorSuccessResponseMessage>;
  completeFn: (formData: FormData) => Promise<ErrorSuccessResponseMessage>;
  base: any;
  view?: string;
  showStepper?: boolean;
  afterCompleteFn?: () => void;
  submitButton?: string;
  OAuthComponent?: React.ReactNode;
  submitButtonIcon?: React.ReactElement;
};

export default function DynamicForm({
  layout,
  lang = "en",
  saveFn,
  showStepper = true,
  completeFn,
  base,
  view,
  submitButtonIcon = <Send className="w-4 h-4" />,
  submitButton = "Submit",
  afterCompleteFn,
}: Props) {
  const [page, setPage] = React.useState(0);
  const [values, setValues] = React.useState(base);
  const [complete, setComplete] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const prevPage = (prevValues: any) => {
    //I save the values again after going back to avoid losing data in the form.
    setValues((currentValues: any) => {
      return {
        ...currentValues,
        ...prevValues,
      };
    });
    setPage((p) => p - 1);
  };
  return (
    <div
      key={"formPage" + page}
      className={`w-full flex-col flex items-center justify-center z-[10] `}
    >
      {showStepper && layout.length > 1 && (
        <ProgressStepper page={page} layout={layout} />
      )}
      {layout?.map(
        ({ title, fields }, i: number) =>
          page === i && (
            <Formik
              key={"formikPage" + i}
              initialValues={getInitialValues(layout, values)}
              enableReinitialize={false}
              onSubmit={async (newValues, actions) => {
                setIsLoading(true);
                setValues((prevValues: any) => ({
                  ...prevValues,
                  ...newValues,
                }));
                const updatedValues = { ...values, ...newValues };
                const formData = new FormData();
                formData.append("values", JSON.stringify(updatedValues));
                formData.append("page", page.toString());
                try {
                  if (saveFn) {
                    const { error, success } = await saveFn(formData);
                    if (success) {
                      toast.success(success);
                    }
                    if (error) {
                      throw new Error(error);
                    }
                  }
                  if (page === layout.length - 1) {
                    const { error, success } = await completeFn(formData);
                    // setComplete(true);
                    if (success) {
                      toast.success(success);
                    }
                    if (error) {
                      throw new Error(error);
                    }
                    if (afterCompleteFn) {
                      afterCompleteFn();
                    }
                    return;
                  } else {
                    setPage((p) => p + 1);
                  }
                } catch (error) {
                  toast.error("Error", {
                    description: error?.message,
                  });
                  return;
                } finally {
                  actions.setSubmitting(false);
                  setIsLoading(false);
                }
              }}
            >
              {({ handleSubmit, values, errors, touched }) => (
                <form
                  key={"formPage" + i}
                  className={` w-full basis-full flex max-w-[660px] flex-col  z-10 gap-y-4 `}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  {title && (
                    <h3 className="font-semibold w-full flex gap-2 items-center text-foreground pl-2 border-l-2 border-foreground">
                      <span> {title}</span>
                    </h3>
                  )}
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={"formFields" + i}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.4, type: "spring" }}
                      className="flex flex-col gap-2"
                    >
                      {fields?.map(
                        (field: DynamicFieldType | DynamicFieldType[]) => {
                          return (
                            <DynamicField
                              errors={errors}
                              touched={touched}
                              field={field}
                              values={values}
                            />
                          );
                        },
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {view === "signin" && (
                    <>
                      <Link
                        className=" text-xs text-end text-blue-500"
                        href={getURL("/sign-in/forgot-password")}
                      >
                        Forgot your password?
                      </Link>
                    </>
                  )}
                  {!Array.isArray(fields[0]) &&
                    fields[0]?.type !== "welcome_message" && (
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={page}
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          transition={{ duration: 0.4, type: "spring" }}
                          className="flex gap-4"
                        >
                          {!complete && i > 0 && (
                            <Button
                              type="button"
                              className="bg-primary w-full"
                              onClick={() => prevPage(values)}
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </Button>
                          )}

                          <SubmitButton
                            className="bg-primary w-full"
                            disabled={isLoading || complete}
                          >
                            {!isLoading && (
                              <>
                                {i === layout.length - 1
                                  ? lang === "en"
                                    ? submitButton
                                    : "Soumettre"
                                  : lang === "en"
                                    ? "Next"
                                    : "Suivant"}

                                {i === layout.length - 1 ? (
                                  submitButtonIcon
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </>
                            )}
                            {isLoading && (
                              <>
                                <LoaderCircle className="w-4 h-4 animate-spin" />
                                <p>{lang === "en" ? "Wait..." : "Chargement"}</p>
                              </>
                            )}
                          </SubmitButton>
                        </motion.div>
                      </AnimatePresence>
                    )}
                </form>
              )}
            </Formik>
          ),
      )}
    </div>
  );
}
