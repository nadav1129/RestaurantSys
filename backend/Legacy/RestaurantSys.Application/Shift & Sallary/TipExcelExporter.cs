// File: TipExcelExporter.cs
using System;
using ClosedXML.Excel;

namespace RestaurantSys.Application.Payroll
{
    /*--------------------------------------------------------------------
    Class: TipExcelExporter
    Purpose: Exports a DailyPayrollTables result into an Excel workbook
             with three sheets: Summary, Staff, Managers.
    Depends on: ClosedXML (install via NuGet)
    --------------------------------------------------------------------*/
    public static class TipExcelExporter
    {
        public static string Export(DailyPayrollTables result, string path)
        {
            using var wb = new XLWorkbook();

            // --- Summary ---
            var ws = wb.Worksheets.Add("Summary");
            ws.Cell("A1").Value = "A_TotalTips"; ws.Cell("B1").Value = result.Summary.A_TotalTips;
            ws.Cell("A2").Value = "AfterTax"; ws.Cell("B2").Value = result.Summary.AfterTax;
            ws.Cell("A3").Value = "StaffPool"; ws.Cell("B3").Value = result.Summary.StaffPool;
            ws.Cell("A4").Value = "ManagersPool"; ws.Cell("B4").Value = result.Summary.ManagersPool;
            ws.Columns().AdjustToContents();

            // --- Staff table ---
            var staff = wb.Worksheets.Add("Staff");
            staff.Cell(1, 1).Value = "Worker";
            staff.Cell(1, 2).Value = "Role";
            staff.Cell(1, 3).Value = "Hours";
            staff.Cell(1, 4).Value = "TipPay";
            staff.Cell(1, 5).Value = "TopUp";
            staff.Cell(1, 6).Value = "Total";
            var r = 2;
            foreach (var x in result.StaffTable)
            {
                staff.Cell(r, 1).Value = x.WorkerName;
                staff.Cell(r, 2).Value = x.Role;
                staff.Cell(r, 3).Value = x.Hours;
                staff.Cell(r, 4).Value = x.TipPay;
                staff.Cell(r, 5).Value = x.EstablishmentTopUp;
                staff.Cell(r, 6).Value = x.TotalPay;
                r++;
            }
            staff.Columns().AdjustToContents();

            // --- Managers table ---
            var mgr = wb.Worksheets.Add("Managers");
            mgr.Cell(1, 1).Value = "Worker";
            mgr.Cell(1, 2).Value = "Role";
            mgr.Cell(1, 3).Value = "Hours";
            mgr.Cell(1, 4).Value = "TipPay";
            r = 2;
            foreach (var x in result.ManagersTable)
            {
                mgr.Cell(r, 1).Value = x.WorkerName;
                mgr.Cell(r, 2).Value = x.Role;
                mgr.Cell(r, 3).Value = x.Hours;
                mgr.Cell(r, 4).Value = x.TipPay;
                r++;
            }
            mgr.Columns().AdjustToContents();

            wb.SaveAs(path);
            return path;
        }
    }
}
