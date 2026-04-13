sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "zapp/utils/SearchData",
    "zapp/utils/FilterData",
    "zapp/utils/SortData",
    "zapp/utils/PersonalizationData",
    "zapp/models/DataFormatter",
    "zapp/models/GetData",
    "zapp/utils/UploadExcelData",
    "zapp/utils/DownloadExcelData",
    "zapp/api/SaveToDatabase",
    "zapp/utils/GridValidator"
], function (
    Controller, fioriLibrary, SearchData, FilterData, SortData, PersonalizationData,
    DataFormatter, GetData, UploadExcelData, DownloadExcelData, SaveToDatabase, GridValidator
) {
    "use strict";

    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [],
        _oDataRaw: [],

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();
            this.oRouter = oOwnerComponent.getRouter();
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var sNewTableName = oEvent.getParameter("arguments").tableName || "";
            var sCurrentTableName = oDisplayModel.getProperty("/CurrentTable");

            if (sCurrentTableName === sNewTableName && oDisplayModel.getProperty("/Meta")?.length > 0) {
                return;
            }

            var state = oEvent.getParameter("arguments").newTable || false;
            if (!state) {
                return;
            }

            oDisplayModel.setProperty("/CurrentTable", sNewTableName);
            oDisplayModel.setProperty("/searchQuery", "");

            var oTable = this.byId("TablePage") || this.byId("dataTable");
            if (oTable) oTable.setBusy(true);
            var oModel = this.getOwnerComponent().getModel();

            var oSettingsModel = this.getView().getModel("settingsModel");
            var sLang = oSettingsModel ? oSettingsModel.getProperty("/selectedLanguage") : "E";

            GetData.loadMeta(oModel, sNewTableName, "", sLang).then(function (oPayload) {
                this._processPayload(oPayload);
                this._displayData();
            }.bind(this))
                .catch(function (err) {
                    console.error("Load Meta/Data Error:", err);
                    sap.m.MessageBox.error("Lỗi khi tải dữ liệu bảng.");
                })
                .finally(function () {
                    if (oTable) oTable.setBusy(false);
                });
        },

        _processPayload: function (oPayload) {
            var aRawMeta = oPayload.metadata || [];
            console.log(aRawMeta);

            var oUniqueMap = new Map();
            aRawMeta.forEach(item => {
                var sFieldName = item.fieldname || item.fieldName;
                if (sFieldName && !oUniqueMap.has(sFieldName)) {
                    item.field_pos = item.fieldPos;
                    item.scrtext_m = item.scrTextM;
                    oUniqueMap.set(sFieldName, item);
                }
            });

            this._oMetaRaw = Array.from(oUniqueMap.values());
            console.log(this._oMetaRaw);

            this._oMetaRaw.sort((a, b) => parseInt(b.fieldPos) - parseInt(a.fieldPos));
            this._oFieldName = this._oMetaRaw.map(prop => prop.fieldname || prop.fieldName);

            var sActualTableName = this._oMetaRaw[0]?.tableName || this._oMetaRaw[0]?.table_name || "Unknown";
            var sActualTableDesc = this._oMetaRaw[0]?.tableDescription || this._oMetaRaw[0]?.table_description || this._oMetaRaw[0]?.Description || "No description available";
            var iColCount = this._oMetaRaw.length;

            this.getView().getModel("view")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("overall")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("overall")?.setProperty("/tableDesc", sActualTableDesc);
            this.getView().getModel("overall")?.setProperty("/colCount", iColCount);

            this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
            this.getView().getModel("displayModel").setProperty("/Data", oPayload.dataRows);
            this.getView().getModel("displayModel").setProperty("/UiMeta", this._oMetaRaw);

            var aRawData = oPayload.dataRows || this.getView().getModel("displayModel").getProperty("/Data") || [];
            var aFormattedData = [];

            aRawData.forEach(function (rowObj, rowIndex) {
                var oNewRow = {};

                var oActualData = {};
                if (rowObj.data) {
                    try {
                        oActualData = JSON.parse(rowObj.data);
                    } catch (e) {
                        console.error("Lỗi parse JSON ở dòng " + rowIndex, e);
                    }
                }

                var sRowUuid = rowObj.uuid || "";

                this._oMetaRaw.forEach(function (colMeta, iIndex) {
                    var sFieldName = colMeta.fieldname || colMeta.fieldName;

                    var sValue = "";
                    if (oActualData[sFieldName] !== undefined) {
                        sValue = oActualData[sFieldName];
                    } else {
                        var sMatchingKey = Object.keys(oActualData).find(k => k.toUpperCase() === sFieldName.toUpperCase());
                        if (sMatchingKey) {
                            sValue = oActualData[sMatchingKey];
                        }
                    }

                    oNewRow[iIndex] = {
                        value: sValue,
                        isEditable: false,
                        isNew: false,
                        fieldname: sFieldName,
                        table_name: colMeta.tableName || colMeta.table_name,
                        has_value_help: !!(colMeta.has_value_help || colMeta.hasValueHelp),
                        field_pos: colMeta.fieldPos || colMeta.field_pos,
                        datatype: colMeta.datatype || colMeta.dataType,
                        row_id: rowObj.rowId || rowObj.row_id || (rowIndex + 1).toString(),
                        uuid: sRowUuid
                    };
                });

                aFormattedData.push(oNewRow);
            }.bind(this));

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
            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var result = this._oDataRaw;
            console.log(result);

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
            var sTableName = this.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
            var sSavedData = window.localStorage.getItem(sStorageKey);

            var bVisibleDefault = (iIndex < 10);
            if (sSavedData) {
                try {
                    var aSavedCols = JSON.parse(sSavedData);
                    var oMatch = aSavedCols.find(function (c) { return c.index === iIndex; });
                    if (oMatch) {
                        bVisibleDefault = oMatch.visible;
                    }
                } catch (e) { }
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
                        }).data("tableName", oMeta.table_name || oMeta.tableName || "")
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
                var bHasVH = (colMeta.has_value_help === true || colMeta.hasValueHelp === true ||
                    colMeta.hasValueHelp === "X" || colMeta.has_value_help === "X" ||
                    colMeta.hasValueHelp === "true" || colMeta.has_value_help === "true");

                console.log("Cột: " + (colMeta.fieldname || colMeta.fieldName) + " | Có kính lúp: " + bHasVH);

                oNewRow[iIndex] = {
                    value: "",
                    isEditable: true,
                    isNew: true,
                    fieldname: colMeta.fieldname || colMeta.fieldName,
                    table_name: colMeta.table_name || colMeta.tableName,
                    field_pos: colMeta.field_pos || colMeta.fieldPos,
                    has_value_help: bHasVH,
                    datatype: colMeta.datatype || colMeta.dataType
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

            var aOldRows = aData.filter(row => !(row[0] && row[0].isNew));

            oTable.setBusy(true);

            if (aNewRows.length === 0) {
                oTable.setBusy(false);
                return;
            }

            var aPromises = {};
            var tableName = "";
            var bHasError = false;
            var sErrorMessage = "";

            var aKeyIndexes = [];

            aMeta.forEach(function (col, idx) {
                var sColName = (col.fieldname || col.fieldName || "").toUpperCase();

                if (col.keyflag === "X" || col.keyFlag === "X" ||
                    col.isKey === true || col.is_key === true || col.IsKey === true ||
                    sColName === "ID" || sColName === "CODE" ||
                    sColName.indexOf("_ID") !== -1 || sColName.indexOf("_CODE") !== -1) {
                    aKeyIndexes.push(idx);
                }
            });

            if (aKeyIndexes.length === 0) {
                aKeyIndexes.push(0);
            }

            aNewRows.forEach(function (oNewRow) {
                var bIsDuplicate = aOldRows.some(function (oOldRow) {
                    return aKeyIndexes.every(function (iKey) {
                        var sNewVal = oNewRow[iKey] ? String(oNewRow[iKey].value).trim().toUpperCase() : "";
                        var sOldVal = oOldRow[iKey] ? String(oOldRow[iKey].value).trim().toUpperCase() : "";
                        return sNewVal === sOldVal && sNewVal !== "";
                    });
                });

                if (bIsDuplicate) {
                    bHasError = true;
                    var sKeyNames = aKeyIndexes.map(i => aMeta[i].fieldname || aMeta[i].fieldName).join(", ");
                    sErrorMessage += "Duplicate Error: The value for [" + sKeyNames + "] already exists!\n";
                }
            });

            if (bHasError) {
                oTable.setBusy(false);
                sap.m.MessageBox.error(sErrorMessage);
                return;
            }

            aNewRows.forEach(oRow => {
                var sStartDate = "", sEndDate = "";
                var sStartFieldName = "", sEndFieldName = "";

                Object.keys(oRow).forEach(key => {
                    if (!isNaN(key)) {
                        var oCell = oRow[key];
                        if (oCell && oCell.fieldname) {
                            tableName = oCell.table_name;

                            var oValidation = GridValidator.checkCellFormat(
                                oCell.value,
                                oCell.datatype,
                                { fieldname: oCell.fieldname }
                            );

                            if (!oValidation.valid) {
                                bHasError = true;
                                sErrorMessage += "Field [" + oCell.fieldname + "]: " + oValidation.msg + "\n";
                            } else {
                                aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                            }

                            if (oCell.value) {
                                var sFN = oCell.fieldname.toUpperCase();
                                if (sFN === "START_DATE" || sFN === "STRAT_DATE" || sFN === "BEGDA") {
                                    sStartDate = String(oCell.value).trim();
                                    sStartFieldName = oCell.fieldname;
                                } else if (sFN === "END_DATE" || sFN === "ENDDA") {
                                    sEndDate = String(oCell.value).trim();
                                    sEndFieldName = oCell.fieldname;
                                }
                            }
                        }
                    }
                });

                if (sStartDate !== "" && sEndDate !== "") {
                    var dStart = new Date(sStartDate);
                    var dEnd = new Date(sEndDate);
                    if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
                        if (dEnd < dStart) {
                            bHasError = true;
                            sErrorMessage += "Row Error: [" + sEndFieldName + "] must be later than [" + sStartFieldName + "].\n";
                        }
                    }
                }
            });

            if (bHasError) {
                oTable.setBusy(false);
                sap.m.MessageBox.error("Invalid data format detected. Please fix the errors below before saving:\n\n" + sErrorMessage);
                return;
            }

            var codeData = GetData.encodeFunction(aPromises);
            if (codeData) {
                this._sendToBackend(tableName, codeData);
            } else {
                oTable.setBusy(false);
                sap.m.MessageBox.error("Can't add more row", {
                    title: "Warning",
                    onClose: function () { this.onRollback(); }.bind(this)
                });
            }
        },

        _sendToBackend: function (table, data) {
            var oView = this.getView();
            var oModel = oView.getModel();

            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            console.log("Quyền hiện tại: Manager?", bIsManager, "| Admin?", bIsAdmin);
            if (bIsManager || bIsAdmin) {
                sap.ui.core.BusyIndicator.show(0);
                SaveToDatabase.onSaveDB(table, oView).then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Updated to database successfully!");

                    this._refreshData(table);
                    this._onEditToggleButtonPress();
                }.bind(this)).catch(function () {
                    sap.ui.core.BusyIndicator.hide();
                });
                return;
            }

            var oFinalPayload = {
                "table_name": table,
                "data": data
            };
            var oListBinding = oModel.bindList("/Data");
            var oContext = oListBinding.create(oFinalPayload);

            oContext.created().then(function () {
                sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval!");
                this._refreshData(table);
                this._onEditToggleButtonPress();
            }.bind(this)).catch(function (oError) {
                this.byId("dataTable").setBusy(false);
                if (oContext.isTransient()) {
                    oContext.delete();
                }
                sap.m.MessageBox.error("Error updating temporary table: " + oError.message);
            }.bind(this));
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
                });
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
                });
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

            GetData.loadMeta(oModel, sTableName, "", sLang)
                .then(function (oPayload) {
                    this._processPayload(oPayload);
                    this._displayData();
                    sap.m.MessageToast.show("Data already update.");
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