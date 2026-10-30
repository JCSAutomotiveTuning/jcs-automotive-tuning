/** Research directory, NOT protocol-level compatibility. Never assert a read/write method from an ECU-family name alone. */
export const ECU_FAMILIES = [
 "EDC15","EDC16","EDC17","MD1","MDC","MED9","MED17","MG1","ME7","ME9","ME17","SIMOS","PCR2.1","SID","DCM","DCU","MJD","MARELLI","DENSO","DELPHI","KEIHIN","HITACHI","CONTINENTAL","SIEMENS","VALEO","BOSCH","TRICORE","C39","EMS","MELCO",
 "DQ200","DQ250","DQ381","DQ500","DL501","DL382","ZF6HP","ZF8HP","ZF9HP","7G-TRONIC","9G-TRONIC","AISIN","GM6L","GM8L"
] as const;
export const TOOL_DIRECTORY = [
 {name:"Alientech KESS3",category:"ECU/TCU programmer",source:"https://www.alientech-tools.com/en/kess3",methods:"OBD, bench and boot (protocol-dependent)"},
 {name:"AutoTuner",category:"ECU/TCU programmer",source:"https://www.autotuner.com/pages/compatibility",methods:"OBD, bench and boot (protocol-dependent)"},
 {name:"Magic Motorsport FLEX",category:"ECU/TCU programmer",source:"https://www.magicmotorsport.com/en/flex-/",methods:"OBD, bench and boot (protocol-dependent)"},
 {name:"Dimsport New Genius",category:"ECU programmer",source:"https://www.dimsport.it/",methods:"Check official vehicle list"},
 {name:"Dimsport New Trasdata",category:"Bench programmer",source:"https://www.dimsport.it/",methods:"Check official vehicle list"},
 {name:"CMDFlash",category:"ECU/TCU programmer",source:"https://www.flashtec.ch/",methods:"Check official supported protocols"},
 {name:"bFlash",category:"ECU/TCU programmer",source:"https://bflash.eu/",methods:"Check official supported protocols"},
 {name:"BitBox",category:"ECU programmer",source:"https://bitsoftware.com/",methods:"Check official supported modules"},
 {name:"PCMflash",category:"ECU/TCU programmer",source:"https://pcmflash.ru/",methods:"Check official module list"},
 {name:"FoxFlash",category:"ECU programmer",source:"https://www.foxflash.com/",methods:"Check official supported protocols"},
 {name:"KT200",category:"ECU programmer",source:"https://www.kt200.com/",methods:"Check official supported protocols"},
 {name:"KESS V2",category:"Legacy ECU programmer",source:"https://www.alientech-tools.com/",methods:"Check exact tool version and official legacy list"},
 {name:"KTAG",category:"Legacy ECU programmer",source:"https://www.alientech-tools.com/",methods:"Check exact tool version and official legacy list"},
 {name:"MPPS",category:"ECU programmer",source:"",methods:"Version and protocol dependent; verify manufacturer"},
 {name:"Galletto / FGTech",category:"ECU programmer",source:"",methods:"Version and protocol dependent; verify manufacturer"},
 {name:"VVDI Prog",category:"EEPROM/MCU programmer",source:"https://www.xhorsevvdi.com/",methods:"Not a general ECU OBD flasher"},
 {name:"CG100",category:"EEPROM/MCU programmer",source:"",methods:"Not a general ECU OBD flasher"},
 {name:"SM2 / Scanmatik",category:"Vehicle interface",source:"https://scanmatik.ru/",methods:"Requires compatible flashing software"},
 {name:"Tactrix Openport 2.0",category:"J2534 interface",source:"https://www.tactrix.com/",methods:"Requires compatible flashing software"},
 {name:"VCDS",category:"VAG diagnostic tool",source:"https://www.ross-tech.com/",methods:"Diagnostics and coding, not a generic ECU map flasher"},
 {name:"ODIS",category:"VAG service engineering software",source:"",methods:"Factory-guided programming depends on authorised access"},
 {name:"VCP",category:"VAG diagnostic/coding tool",source:"",methods:"Verify exact firmware functions"},
 {name:"Autel MaxiSys",category:"Diagnostic/programming platform",source:"https://autel.com/",methods:"Model-specific functions; not generic tuning flasher"},
 {name:"Launch X431",category:"Diagnostic/programming platform",source:"https://www.launchtech.com/",methods:"Model-specific functions; not generic tuning flasher"},
 {name:"BMW MS4X tools",category:"ECU-family-specific software",source:"https://www.ms4x.net/",methods:"Only supported BMW Siemens ECU families"},
] as const;
export function toolDirectoryForFamily(family:string) {
 const q=family.trim().toUpperCase();
 return {familyRecognised:ECU_FAMILIES.some(v=>q.includes(v)||v.includes(q)),entries:TOOL_DIRECTORY};
}
