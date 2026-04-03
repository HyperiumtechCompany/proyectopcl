import ExcelJS from 'exceljs';
import { exportBombeoTanqueElevadoToExcel } from './bombeo_tanque_elevado';
import { exportCisternaToExcel } from './cisterna';
import { exportDemandaDiariaToExcel } from './demanda_diaria';
import { exportMaxDemandaSimultaneaToExcel } from './maxima_demanda';
import { exportRedAlimentacionToExcel } from './red_alimentacion';
import { exportRedRiegoToExcel } from './red_riego';
import { exportRedesInterioresToExcel } from './redes_interiores';
import { exportTanqueElevadoToExcel } from './tanque_elevado';
import { exportTuberiasRDToExcel } from './tuberias_RD';

export async function exportAguaToExcel(dataSheet: any, fileName: string = 'Calculo_Agua') {
    const workbook = new ExcelJS.Workbook();

    // Agregar cada una de las 9 hojas al libro
    await exportDemandaDiariaToExcel(workbook, dataSheet);
    await exportCisternaToExcel(workbook, dataSheet);
    await exportTanqueElevadoToExcel(workbook, dataSheet);
    await exportRedAlimentacionToExcel(workbook, dataSheet);
    await exportMaxDemandaSimultaneaToExcel(workbook, dataSheet);
    await exportBombeoTanqueElevadoToExcel(workbook, dataSheet);
    await exportTuberiasRDToExcel(workbook, dataSheet);
    await exportRedesInterioresToExcel(workbook, dataSheet);
    await exportRedRiegoToExcel(workbook, dataSheet);

    // Generar archivo Excel y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}