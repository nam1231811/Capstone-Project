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
], function (
    Controller, fioriLibrary, SearchData, FilterData, SortData, PersonalizationData,
    DataFormatter, UploadExcelData, DownloadExcelData, SaveToDatabase, GridValidator, LoadData
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
            var aRawMeta = oPayload.metadata || [];
            var oUniqueMap = new Map();
            console.log(aRawMeta);
            
            aRawMeta.forEach(item => {
                var sFieldName = item.fieldname;
                if (sFieldName && !oUniqueMap.has(sFieldName)) {
                    item.field_pos = item.fieldPos;
                    item.scrtext_m = item.scrTextM;
                    oUniqueMap.set(sFieldName, item);
                }
            });
            var aBaseMeta = Array.from(oUniqueMap.values());
            var aUiMeta = JSON.parse(JSON.stringify(aBaseMeta));
            aUiMeta.sort(function (a, b) {
                var posA = parseInt(a.field_pos, 10) || 0;
                var posB = parseInt(b.field_pos, 10) || 0;
                return posA - posB;
            });
            var aTableMeta = JSON.parse(JSON.stringify(aBaseMeta));
            aTableMeta.sort(function (a, b) {
                var checkIsKey = function (col) {
                    var sColName = (col.fieldname || "").toUpperCase();
                    return (col.keyflag === "X"  ||
                        sColName === "ID" || 
                        sColName === "CODE" ||
                        sColName.indexOf("_ID") !== -1 || 
                        sColName.indexOf("_CODE") !== -1);
                };
                var aIsKey = checkIsKey(a);
                var bIsKey = checkIsKey(b);
                if (aIsKey && !bIsKey) return -1;
                if (!aIsKey && bIsKey) return 1;
                var posA = parseInt(a.field_pos, 10) || 0;
                var posB = parseInt(b.field_pos, 10) || 0;
                return posA - posB;
            });
            this._oMetaRaw = aTableMeta;
            this._oFieldName = this._oMetaRaw.map(prop => prop.fieldname);

            var sActualTableName = this._oMetaRaw[0]?.tableName || "Unknown";
            var sActualTableDesc = this._oMetaRaw[0]?.tableDescription || "No description available";
            var iColCount = this._oMetaRaw.length;

            this.getView().getModel("view")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("overall")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("overall")?.setProperty("/tableDesc", sActualTableDesc);
            this.getView().getModel("overall")?.setProperty("/colCount", iColCount);
            this.getView().getModel("displayModel").setProperty("/Meta", aTableMeta);
            this.getView().getModel("displayModel").setProperty("/UiMeta", aUiMeta);
            this.getView().getModel("displayModel").setProperty("/Data", oPayload.dataRows);

            var aRawData = oPayload.dataRows || this.getView().getModel("displayModel").getProperty("/Data") || [];
            var aFormattedData = [];

            aRawData.forEach(function (rowObj, rowIndex) {
                var oNewRow = {};
                var oActualData = {};
                if (rowObj.data) {
                    try {
                        oActualData = JSON.parse(rowObj.data);
                    } catch (e) {
                        console.error("Error parse json" + rowIndex, e);
                    }
                }

                var sRowUuid = rowObj.uuid || "";

                this._oMetaRaw.forEach(function (colMeta, iIndex) {
                    var sFieldName = colMeta.fieldname;
                    var key = false;
                    if (colMeta.keyflag === 'X') {
                        key = true;
                    }
                    var sValue = "";
                    if (oActualData[sFieldName] !== undefined) {
                        sValue = oActualData[sFieldName];
                    } else {
                        var sMatchingKey = Object.keys(oActualData).find(k => k.toUpperCase() === sFieldName.toUpperCase());
                        if (sMatchingKey) {
                            sValue = oActualData[sMatchingKey];
                        }
                    }

                    var bHasVH = (colMeta.hasValueHelp === "X");

                    oNewRow[iIndex] = {
                        value: sValue,
                        isEditable: false,
                        isNew: false,
                        fieldname: sFieldName,
                        table_name: colMeta.tableName,
                        has_value_help: bHasVH,
                        field_pos: colMeta.field_pos,
                        datatype: colMeta.datatype,
                        row_id: rowObj.rowId || rowObj.row_id || (rowIndex + 1).toString(),
                        uuid: sRowUuid,
                        length: colMeta.leng,
                        keyFlag: key,
                        createdBy: rowObj.createdBy,
                        createdAt: DataFormatter.formatDateTime(rowObj.createdAt),
                        changedBy: rowObj.changedBy,
                        changedAt: DataFormatter.formatDateTime(rowObj.changedAt)
                    };
                });
                aFormattedData.push(oNewRow);
            }.bind(this));

            var sRecentKey = this._sRecentlySavedKey;

            aFormattedData.sort(function (a, b) {
                var valA = a[0] ? String(a[0].value).trim() : "";
                var valB = b[0] ? String(b[0].value).trim() : "";

                if (sRecentKey) {
                    if (valA === sRecentKey) return -1;
                    if (valB === sRecentKey) return 1;
                }

                var numA = parseFloat(valA);
                var numB = parseFloat(valB);

                if (!isNaN(numA) && !isNaN(numB)) {
                    return numB - numA;
                } else {
                    return String(valB).localeCompare(String(valA));
                }
            });

            this._oDataRaw = aFormattedData;

            var minRec = this._oDataRaw.length < 10 ? this._oDataRaw.length : 10;
            var oOverallModel = this.getView().getModel("overall");
            if (oOverallModel) {
                oOverallModel.setProperty("/minRecord", minRec);
                oOverallModel.setProperty("/count", this._oDataRaw.length);
            }

            this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
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
                        }).data("tableName", oMeta.tableName || "")
                            .data("fieldName", oMeta.fieldname || "")
                    ]
                })
            });


            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colIndex", value: iIndex }));
            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colName", value: sHeaderText }));


            return oColumn;
        },

        onPersonalization: function () {
            PersonalizationData.onPersonalization.call(this);
        },

        onColumnSelect: function (oEvent) {
            SortData.onColumnSelect.call(this, oEvent);
        },

        onSortColumnDirect: function (bDescending, iColIndex, bMultiSort, bGroup) {
            SortData.onSortColumnDirect.call(this, bDescending, iColIndex, bMultiSort, bGroup);
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

        onAdd: function () {
            var footer = this._onEditToggleButtonPress();
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
                // Tìm nhanh vị trí của cột Khóa chính để lưu RecentlySavedKey
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
                    this._onEditToggleButtonPress();
                }.bind(this)).catch(function (oError) {
                    tableView.setBusy(false);
                    sap.ui.core.BusyIndicator.hide();
                    this._refreshData(table);
                    this._onEditToggleButtonPress();
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
                    this._onEditToggleButtonPress();
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
                    this._onEditToggleButtonPress();
                }
            }.bind(this));
            var oContext = oListBinding.create(oFinalPayload);
        },

        _onEditToggleButtonPress: function () {
            var oObjectPage = this.getView().byId("TableContent"),
                bCurrentShowFooterState = oObjectPage.getShowFooter(),
                oModel = this.getView().getModel("displayModel"),
                aData = oModel.getProperty("/Data") || [];

            oObjectPage.setShowFooter(!bCurrentShowFooterState);
            if (bCurrentShowFooterState) {
                if (aData.length > 0 && aData[0][0] && aData[0][0].isNew) {
                    aData.shift();
                    oModel.setProperty("/Data", aData);
                }
            }
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

        onUploadExcelPress: function (oEvent) {
            UploadExcelData.onUploadExcelPress.call(this, oEvent);
        },

        onDownloadExcelPress: function () {
            DownloadExcelData.onDownloadExcelPress(this);
        },

        onDynamicValueHelp: function (oEvent) {
            var oInput = oEvent.getSource();
            var sTableName = oInput.data("tableName");
            var sFieldName = oInput.data("fieldName");

            if (!sTableName || !sFieldName) {
                console.error("Missing Metadata for Value Help");
                return;
            }

            if (!this._oDynamicVHDialog) {
                this._oDynamicVHDialog = new sap.m.SelectDialog({
                    title: "Select Value",
                    confirm: this.onValueHelpConfirm.bind(this)
                });
                this.getView().addDependent(this._oDynamicVHDialog);
            }

            var aFilters = [
                new sap.ui.model.Filter("TableName", "EQ", sTableName),
                new sap.ui.model.Filter("FieldName", "EQ", sFieldName)
            ];

            this._oDynamicVHDialog.bindAggregation("items", {
                path: "/DynamicVHSet",
                template: new sap.m.StandardListItem({
                    title: "{KeyValue}",
                    description: "{Description}",
                    info: "{FieldName}"
                }),
                filters: aFilters
            });

            this._oDynamicVHDialog.data("targetInput", oInput);
            this._oDynamicVHDialog.open();
        },

        onValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var oInput = oEvent.getSource().data("targetInput");
                var sSelectedKey = oSelectedItem.getTitle();
                oInput.setValue(sSelectedKey);
                oInput.fireChange({ value: sSelectedKey });
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

        _validateLiveGrid: function () {
            var oModel = this.getView().getModel("displayModel");
            var aCleanedData = GridValidator.performLiveValidation(oModel.getProperty("/Data"), oModel.getProperty("/Meta"));
            oModel.setProperty("/Data", aCleanedData);
        },
    });
});

