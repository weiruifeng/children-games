import type {PlantKind} from '@children-games/shared';
import {characterUrl} from '../assets/manifest';
export function PartnerIcon({kind,size=64}:{kind:PlantKind;size?:number}){return <img src={characterUrl(kind)} width={size} height={size} style={{objectFit:'contain'}} alt="" draggable={false}/>;}
