import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export default create(subscribeWithSelector((set) =>
{
    return {
        /**
         * Scroll
         */
        step: 0,

        setStep: (step) => set({ step }),

        /**
         * Textures
         */
        swatches: [],
        activeSwatch: 'aberration',
        applyId: null,
        applySeq: 0,

        setSwatches: (swatches) => set({ swatches }),

        requestApply: (id) => set((state) =>
        {
            return { applyId: id, applySeq: state.applySeq + 1, activeSwatch: id }
        }),
    }
}))
