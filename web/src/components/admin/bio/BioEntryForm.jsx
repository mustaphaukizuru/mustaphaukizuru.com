/* ──────────────────────────────────────────────────────────────────────────
 *  BioEntryForm · shared modal form shell for every Bio CMS entry type
 *
 *    <BioEntryForm
 *      title="Edit experience"
 *      schema={experienceSchema}
 *      initialValues={...}
 *      onSubmit={(parsed) => save(parsed)}   // may throw → mapped inline
 *      onCancel={close}
 *    >
 *      {(form) => <>…bound fields…</>}
 *    </BioEntryForm>
 *
 *  Renders inside the canonical Modal; owns the useForm instance, the
 *  inline error banner and the Cancel / Save row.
 *  ──────────────────────────────────────────────────────────────────── */

import useForm from "../../../hooks/useForm"
import { FormModal, FormErrorBanner, FormActions } from "../forms"

export default function BioEntryForm({ title, schema, initialValues, onSubmit, onCancel, size = "md", children }) {
  const form = useForm({ schema, initialValues, onSubmit })
  return (
    <FormModal open onClose={onCancel} title={title} size={size}>
      <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
        {typeof children === "function" ? children(form) : children}
        <FormErrorBanner message={form.formError} />
        <FormActions onCancel={onCancel} saving={form.submitting} />
      </form>
    </FormModal>
  )
}
