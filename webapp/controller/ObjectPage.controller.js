sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "zapp/utils/SearchData",
    "zapp/utils/FilterData",
    "zapp/utils/SortData",
    "zapp/utils/PersonalizationData",
    "zapp/utils/DataFormatter",
    "zapp/utils/UploadExcelData",
    "zapp/utils/DownloadExcelData",
    "zapp/api/SaveToDatabase",
    "zapp/utils/GridValidator",
    "zapp/api/LoadData",
    "zapp/utils/ValueHelp"
], function (
    Controller, fioriLibrary, SearchData, FilterData, SortData, PersonalizationData,
    DataFormatter, UploadExcelData, DownloadExcelData, SaveToDatabase, GridValidator, LoadData, ValueHelp
) {
    "use strict";


    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [],
        _oDataRaw: [],
        _sRecentlySavedKey: null,

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();
            this.oRouter = oOwnerComponent.getRouter();
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);
        },
        
        _onObjectMatched: function (oEvent) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var sNewTableName = oEvent.getParameter("arguments").tableName || "";
            var sCurrentTableName = oDisplayModel.getProperty("/CurrentTable");
            var oModel = this.getOwnerComponent().getModel();
            var oSettingsModel = this.getView().getModel("settingsModel");
            var sLang = oSettingsModel ? oSettingsModel.getProperty("/selectedLanguage") : "E";
            var oTable = this.byId("TablePage") || this.byId("dataTable");
            var state = oEvent.getParameter("arguments").newTable || false;

            if (sCurrentTableName === sNewTableName && oDisplayModel.getProperty("/Meta")?.length > 0) {
                return;
            }

            if (!state) {
                return;
            }

            if (oTable) {
                oTable.setBusy(true)
            };

            oDisplayModel.setProperty("/CurrentTable", sNewTableName);
            oDisplayModel.setProperty("/searchQuery", "");

            LoadData.loadTableData(oModel, sNewTableName, "", sLang).then(function (oPayload) {
                this._processPayload(oPayload);
                this._displayData();
            }.bind(this)).catch(function (err) {
                console.error("Load Meta/Data Error:", err);
                sap.m.MessageBox.error("No data found for the selected table.");
            }).finally(function () {
                if (oTable) {
                    oTable.setBusy(false)
                };
            });
        },

        _processPayload: function (oPayload) {
            var oView = this.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var oOverallModel = oView.getModel("overall");
            var aRawMeta = oPayload.metadata || [];         
            var oUniqueMap = new Map();
            aRawMeta.forEach(item => {
                if (item.fieldname && !oUniqueMap.has(item.fieldname)) {
                    item.field_pos = item.fieldPos;
                    item.scrtext_m = item.scrTextM;
                    oUniqueMap.set(item.fieldname, item);
                }
            });

            var aBaseMeta = Array.from(oUniqueMap.values());
            var aUiMeta = JSON.parse(JSON.stringify(aBaseMeta));
            aUiMeta.sort((a, b) => (parseInt(a.field_pos, 10) || 0) - (parseInt(b.field_pos, 10) || 0));

            var aTableMeta = JSON.parse(JSON.stringify(aBaseMeta));
            var checkIsKey = col => {
                var sCol = (col.fieldname || "").toUpperCase();
                return col.keyflag === "X" || ["ID", "CODE"].includes(sCol) || sCol.includes("_ID") || sCol.includes("_CODE");
            };

            aTableMeta.sort((a, b) => {
                var aIsKey = checkIsKey(a), 
                    bIsKey = checkIsKey(b);
                if (aIsKey !== bIsKey) return aIsKey ? -1 : 1; 
                return (parseInt(a.field_pos, 10) || 0) - (parseInt(b.field_pos, 10) || 0);
            });

            this._oMetaRaw = aTableMeta;
            this._oFieldName = aTableMeta.map(prop => prop.fieldname);

            var oFirstMeta = aTableMeta[0] || {};
            var sActualTableName = oFirstMeta.tableName || "Unknown";
            var sActualTableDesc = oFirstMeta.tableDescription || "No description available";
                
            oView.getModel("view")?.setProperty("/tableName", sActualTableName);
            if (oOverallModel) {
                oOverallModel.setProperty("/tableName", sActualTableName);
                oOverallModel.setProperty("/tableDesc", sActualTableDesc);
                oOverallModel.setProperty("/colCount", aTableMeta.length);
            }
            
            oDisplayModel?.setProperty("/Meta", aTableMeta);
            oDisplayModel?.setProperty("/UiMeta", aUiMeta);
            var aRawData = oPayload.dataRows || oDisplayModel?.getProperty("/Data") || [];
            console.log(aRawData);
            var aFormattedData = aRawData.map((rowObj, rowIndex) => {
                var oActualData = {};
                if (rowObj.data) {
                    try { oActualData = JSON.parse(rowObj.data); } 
                    catch (e) { 
                        console.error("Error parse json row " + rowIndex, e); 
                    }
                }
            
                var oDataUpperKeys = {};
                for (var key in oActualData) {
                    oDataUpperKeys[key.toUpperCase()] = oActualData[key];
                }
            
                var oNewRow = {};
                this._oMetaRaw.forEach((colMeta, iIndex) => {
                    var sFieldName = colMeta.fieldname;
                    var sValue = oActualData[sFieldName] !== undefined 
                        ? oActualData[sFieldName] 
                        : (oDataUpperKeys[sFieldName.toUpperCase()] || "");
                
                    oNewRow[iIndex] = {
                        value: sValue,
                        isEditable: false,
                        isNew: false,
                        fieldname: sFieldName,
                        table_name: colMeta.tableName,
                        has_value_help: (colMeta.hasValueHelp === "X"),
                        field_pos: colMeta.field_pos,
                        datatype: colMeta.datatype,
                        row_id: rowObj.rowId || rowObj.row_id || String(rowIndex + 1),
                        uuid: rowObj.uuid || "",
                        length: colMeta.leng,
                        keyFlag: (colMeta.keyflag === 'X'),
                        createdBy: rowObj.createdBy,
                        createdAt: DataFormatter.formatDateTime(rowObj.createdAt),
                        changedBy: rowObj.changedBy,
                        changedAt: DataFormatter.formatDateTime(rowObj.changedAt)
                    };
                });
                return oNewRow;
            });
            console.log(aFormattedData);
            
            var sRecentKey = this._sRecentlySavedKey;
            aFormattedData.sort((a, b) => {
                var valA = a[0] ? String(a[0].value).trim() : "";
                var valB = b[0] ? String(b[0].value).trim() : "";
            
                if (sRecentKey) {
                    if (valA === sRecentKey) return -1;
                    if (valB === sRecentKey) return 1;
                }
            
                var numA = parseFloat(valA), 
                    numB = parseFloat(valB);
                return (!isNaN(numA) && !isNaN(numB)) ? (numB - numA) : valB.localeCompare(valA);
            });
        
            this._oDataRaw = aFormattedData;
            if (oOverallModel) {
                oOverallModel.setProperty("/minRecord", Math.min(this._oDataRaw.length, 10));
                oOverallModel.setProperty("/count", this._oDataRaw.length);
            }
            oDisplayModel?.setProperty("/Data", this._oDataRaw);
        },

        _displayData: function () {
            var oTable = this.byId("dataTable");
            oTable.destroyColumns();
            oTable.bindAggregation("columns", {
                path: "displayModel>/Meta",
                factory: this.createDynamicColumn.bind(this)
            });
            oTable.bindRows("displayModel>/Data");
            oTable.detachColumnSelect(this.onColumnSelect, this);
            oTable.attachColumnSelect(this.onColumnSelect, this);
        },

        createDynamicColumn: function (sId, oContext) {
            var oMeta = oContext.getObject();
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop(), 10);
            var sColName = (oMeta && oMeta.fieldname) ? oMeta.fieldname : "unknown_col";
            var sBaseId = "col_" + sColName + "_" + iIndex;
            var oExistingCol = this.getView().byId(sBaseId);

            if (oExistingCol) {
                oExistingCol.destroy();
            }

            var sStableId = this.getView().createId(sBaseId);
            var sTableName = this.getView().getModel("overall").getProperty("/tableName");
            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
            var sSavedData = window.localStorage.getItem(sStorageKey);
            var bVisibleDefault = (iIndex < 10);

            if (sSavedData) {
                try {
                    var aSavedCols = JSON.parse(sSavedData);
                    var oMatch = aSavedCols.find(function (c) { 
                        return c.index === iIndex; 
                    });

                    if (oMatch) {
                        bVisibleDefault = oMatch.visible;
                    }
                } catch (e) {

                }
            }

            var sHeaderText = "N/A";
            if (oMeta) {
                sHeaderText = oMeta.scrtext_l || oMeta.scrtextM || oMeta.scrtext_s || oMeta.fieldname || "N/A";
            }

            var oColumn = new sap.ui.table.Column(sStableId, {
                label: new sap.m.Label({ text: sHeaderText, design: "Bold" }),
                visible: bVisibleDefault,
                width: "auto",
                template: new sap.m.VBox({
                    items: [
                        new sap.m.FormattedText({
                            visible: "{= ${displayModel>" + iIndex + "/isEditable} !== true }",
                            htmlText: {
                                parts: [
                                    "displayModel>" + iIndex + "/value",
                                    "displayModel>/searchQuery"
                                ],
                                formatter: function (sValue, sQuery) {
                                    if (!sValue)
                                        return "";
                                    sValue = sValue.toString();
                                    var sSafeValue = sValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");


                                    if (!sQuery)
                                        return sSafeValue;
                                    var sEscapedQuery = sQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    var regex = new RegExp("(" + sEscapedQuery + ")", "gi");
                                    return sSafeValue.replace(regex, "<span style='background-color: #8ce8fa; font-weight: bold;'>$1</span>");
                                }
                            }
                        }),

                        new sap.m.Input({
                            value: "{displayModel>" + iIndex + "/value}",
                            valueState: "{displayModel>" + iIndex + "/_state}",
                            valueStateText: "{displayModel>" + iIndex + "/_msg}",
                            visible: "{= ${displayModel>" + iIndex + "/isEditable} === true }",
                            showValueHelp: "{= ${displayModel>" + iIndex + "/has_value_help} === true }",
                            valueHelpRequest: this.onDynamicValueHelp.bind(this),
                            change: function (oEvent) {
                                var sColUUID = oMeta.uuid;
                                var oModel = this.getView().getModel("displayModel");
                                var sPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                                oModel.setProperty(sPath + "/uuid", sColUUID);
                                oModel.setProperty(sPath + "/fieldname", oMeta.fieldname);
                                this._validateLiveGrid();
                            }.bind(this)
                        }).data("tableName", oMeta.tableName || "").data("fieldName", oMeta.fieldname || "")
                    ]
                })
            });


            oColumn.addCustomData(new sap.ui.core.CustomData(
                { 
                    key: "colIndex", 
                    value: iIndex 
                }
            ));

            oColumn.addCustomData(new sap.ui.core.CustomData(
                {
                    key: "colName", 
                    value: sHeaderText
                }
            ));

            return oColumn;
        },

        onColumnSelect: function (oEvent) {
            SortData.onColumnSelect.call(this, oEvent);
        },

        onSortColumnDirect: function (bDescending, iColIndex, bMultiSort, bGroup) {
            SortData.onSortColumnDirect.call(this, bDescending, iColIndex, bMultiSort, bGroup);
        },

        onAdd: function () {
            var footer = this.onEditToggleButtonPress();
            var oModel = this.getView().getModel("displayModel");
            var aData = oModel.getProperty("/Data") ? oModel.getProperty("/Data").slice() : [];
            if (footer) {
                return;
            }
            var aMeta = oModel.getProperty("/Meta");
            var oNewRow = {};
            aMeta.forEach(function (colMeta, iIndex) {
                var bHasVH = (colMeta.hasValueHelp === true || colMeta.hasValueHelp === "X" || colMeta.has_value_help === true || colMeta.has_value_help === "X");

                oNewRow[iIndex] = {
                    value: "",
                    isEditable: true,
                    isNew: true,
                    fieldname: colMeta.fieldname,
                    table_name: colMeta.tableName,
                    field_pos: colMeta.field_pos,
                    has_value_help: bHasVH,
                    datatype: colMeta.datatype,
                    length: colMeta.leng,
                    _state: "None",
                    _msg: ""
                };
            }.bind(this));

            aData.unshift(oNewRow);
            oModel.setProperty("/Data", aData);

            oModel.refresh(true);

            var oOverallModel = this.getView().getModel("overall");
            if (oOverallModel) {
                oOverallModel.setProperty("/count", aData.length);
                var minRec = aData.length < 10 ? aData.length : 10;
                oOverallModel.setProperty("/minRecord", minRec > 0 ? minRec : 1);
            }

            var oTable = this.byId("dataTable");
            if (oTable) {
                oTable.setFirstVisibleRow(0);
            }
        },

        onSave: function () {
            var oTable = this.byId("dataTable");
            var oModel = this.getView().getModel("displayModel");
            var aData = oModel.getProperty("/Data");
            var aMeta = oModel.getProperty("/Meta");
            var aNewRows = aData.filter(row => row[0] && row[0].isNew);
            var tableName = "";
            var bHasError = false;
            var oSingleRowData = {};

            oTable.setBusy(true);

            if (aNewRows.length === 0) {
                oTable.setBusy(false);
                return;
            }

            aData = GridValidator.performLiveValidation(aData, aMeta);
            oModel.setProperty("/Data", aData);
            oModel.refresh(true);

            var oNewRow = aNewRows[0];
            Object.keys(oNewRow).forEach(key => {
                if (!isNaN(key) && oNewRow[key]) {
                    var oCell = oNewRow[key];
                    if (oCell.fieldname) tableName = oCell.table_name || tableName;

                    if (oCell._state === "Error") {
                        bHasError = true;
                    } else {
                        oSingleRowData[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                    }
                }
            });

            if (bHasError) {
                oTable.setBusy(false);
                sap.m.MessageBox.error("Please correct the faulty cells (highlighted in red) before saving!");
                return;
            }

            if (Object.keys(oSingleRowData).length > 0) {
                var iFirstKeyIndex = aMeta.findIndex(col =>
                    col.keyflag === "X" || col.isKey === true ||
                    (col.fieldname || "").toUpperCase() === "ID" ||
                    (col.fieldname || "").toUpperCase().indexOf("_ID") !== -1
                );
                iFirstKeyIndex = iFirstKeyIndex !== -1 ? iFirstKeyIndex : 0;

                if (oNewRow[iFirstKeyIndex]) {
                    this._sRecentlySavedKey = String(oNewRow[iFirstKeyIndex].value).trim();
                }

                this._sendToBackend(tableName, oSingleRowData);
            } else {
                oTable.setBusy(false);
                sap.m.MessageBox.error("No valid data to save.");
            }
        },

        _sendToBackend: function (table, oSingleRowData) {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;
            var tableView =this.byId("dataTable");
            
            if (bIsManager || bIsAdmin) {
                sap.ui.core.BusyIndicator.show(0);

                var sBase64Array = DataFormatter.encodeFunction([oSingleRowData]);

                SaveToDatabase.onSaveDB(table, oView, sBase64Array).then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Created in database successfully!");
                    this._refreshData(table);
                    this.onEditToggleButtonPress();
                }.bind(this)).catch(function (oError) {
                    tableView.setBusy(false);
                    sap.ui.core.BusyIndicator.hide();
                    this._refreshData(table);
                    this.onEditToggleButtonPress();
                }.bind(this));
                return;
            }

            sap.ui.core.BusyIndicator.show(0);
            var sSingleBase64 = DataFormatter.encodeFunction(oSingleRowData);
            var oFinalPayload = {
                "table_name": table,
                "data": sSingleBase64
            };

            var oListBinding = oModel.bindList("/Data");

            oListBinding.attachEventOnce("createCompleted", function (oEvent) {
                var bSuccess = oEvent.getParameter("success");
                var oEventContext = oEvent.getParameter("context");
                sap.ui.core.BusyIndicator.hide();
                tableView.setBusy(false);
            
                if (bSuccess) {
                    sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval!");
                    this._refreshData(table);
                    this.onEditToggleButtonPress();
                } else {
                    if (oEventContext && oEventContext.isTransient()) {
                        oEventContext.delete(); 
                    }
                
                    var sBackendError = "Unknown backend error occurred.";
                    var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();

                    if (aMessages && aMessages.length > 0) {
                        var aErrors = aMessages.filter(function (m) { return m.type === "Error"; });
                        if (aErrors.length > 0) {
                            sBackendError = aErrors[aErrors.length - 1].message;
                        }
                    }
                    sap.m.MessageBox.error("Failed to send request:\n\n" + sBackendError);
                    this._refreshData(table);
                    this.onEditToggleButtonPress();
                }
            }.bind(this));
            var oContext = oListBinding.create(oFinalPayload);
        },

        onEditToggleButtonPress: function () {
            var oObjectPage = this.getView().byId("TableContent"),
                bCurrentShowFooterState = oObjectPage.getShowFooter(),
                oModel = this.getView().getModel("displayModel"),
                aData = oModel.getProperty("/Data") || [];
            var oOverallModel = this.getView().getModel("overall");
            oObjectPage.setShowFooter(!bCurrentShowFooterState);
            if (bCurrentShowFooterState) {
                if (aData.length > 0 && aData[0][0] && aData[0][0].isNew) {
                    aData.shift();
                    oModel.setProperty("/Data", aData);
                }
            }
            oOverallModel.setProperty("/count", aData.length);
            return bCurrentShowFooterState
        },

        onMedataPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                var tableName = this.getView().getModel("view").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("Metadata", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                }, true);
            } else {
                console.error("FCL object with ID not found 'fcl'");
            }
        },

        onListItemPress: function (oEvent) {
            var oRowContext = oEvent.getParameter("rowContext");
            if (!oRowContext) {
                return;
            }
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var sPath = oRowContext.getPath();
                var row_id = sPath.split("/").pop();
                var tableName = this.getView().getModel("overall").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("DetailData", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                    ,
                }, true);
            } else {
                console.error("FCL object not found");
            }
        },

        _refreshData: function (sTableName) {
            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var oModel = this.getOwnerComponent().getModel();
            var oSettingsModel = this.getView().getModel("settingsModel");
            var sLang = oSettingsModel ? oSettingsModel.getProperty("/selectedLanguage") : "E";

            if (oTable) {
                oTable.setBusy(true);
            }

            LoadData.loadTableData(oModel, sTableName, "", sLang)
                .then(function (oPayload) {
                    this._processPayload(oPayload);
                    this._displayData();
                }.bind(this))
                .catch(function (err) {
                    console.error("Refresh Error:", err);
                })
                .finally(function () {
                    if (oTable) {
                        oTable.setBusy(false);
                    }
                });
        },

        onDynamicValueHelp: function (oEvent) {
            ValueHelp.openFieldValueHelp(this, oEvent);
        },

        onValueHelpConfirm: function (oEvent) {
            ValueHelp.confirmValueHelp(oEvent);
        },

        onPersonalization: function () {
            PersonalizationData.onPersonalization.call(this);
        },

        _validateLiveGrid: function () {
            var oModel = this.getView().getModel("displayModel");
            var adata = oModel.getProperty("/Data");
            var aMeta = oModel.getProperty("/Meta");
            var aCleanedData = GridValidator.performLiveValidation(adata, aMeta);
            oModel.setProperty("/Data", aCleanedData);
        },

        onUploadExcelPress: function (oEvent) {
            UploadExcelData.onUploadExcelPress.call(this, oEvent);
        },

        onDownloadExcelPress: function () {
            DownloadExcelData.onDownloadExcelPress(this);
        },

        onSearch: function (oEvent) {
            SearchData.onSearch.call(this, oEvent);
        },

        onFilter: function () {
            FilterData.onFilter.call(this);
        },

        onFilterConfirm: function (oEvent) {
            FilterData.onFilterConfirm.call(this, oEvent);
        },
    });
});
