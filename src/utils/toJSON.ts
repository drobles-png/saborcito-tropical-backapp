/**
 * Opciones de serialización comunes: todo documento sale con `id` (string),
 * sin `_id` ni `__v`, que es lo que espera el frontapp.
 */
export const toJSON = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, any>) => {
    delete ret._id;
    return ret;
  },
};

/** Subdocumentos: sin `_id` propio ni virtual `id`. */
export const subdoc = { _id: false, id: false } as const;
