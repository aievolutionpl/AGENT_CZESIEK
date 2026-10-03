import { atom } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

export type InterfaceMaterial = 'liquid' | 'standard'

const KEY = 'czesiek.interface-material.v1'

export const $interfaceMaterial = atom<InterfaceMaterial>(readKey(KEY) === 'standard' ? 'standard' : 'liquid')

export function setInterfaceMaterial(material: InterfaceMaterial): void {
  writeKey(KEY, material)
  $interfaceMaterial.set(material)
}
