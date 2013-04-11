var Editor = $.fn.dataTable.Editor = function(config) {
  config = config || {};
  if (!config.domTable) return alert("Missing editor domTable !");

  this.domTable = config.domTable;
  this.method = config.method || "POST";
  this.url = config.url || "";
  this.idField = config.idField;
  this.done = config.done || done;
  this.fail = config.fail || fail;

  this.title = config.title || "";
  this.fields = buildFields(config.fields || []);
  this.closeText = config.closeText || "close";
  this.validateText = config.validateText || "validate";

  this.formValidation = config.formValidation || function() { return true; };

  _buildModal.call(this);
  this.create = _create.bind(this);
  this.edit = _edit.bind(this);
  this.remove = _remove.bind(this);
  this.error = _setError.bind(this);
}

function _resetErrorField(form) {
  form.find('[id^=error]').each(function() {
    $(this).html("");
  });
}

function _setError(field, message) {
  this.form.find('#error'+field).html(message);
}

// Modal

function _buildModal() {
  var self = this;
  self.modal = $('<div class="modal fade", tabindex="-1", role="dialog",' +
      ' aria-hidden="true"/>').appendTo($(this.domTable));
  _buildModalHeader.call(self);
  _buildModalBody.call(self);
  _buildModalFooter.call(self);
  self.modal.on('hide', function() {
    self.validateButton.off('click');
    _resetErrorField(self.form);
    self.errorBlock.fadeOut();
    clearData.call(self);
  });
}

function _buildModalHeader() {
  var modalHeader = $('<div class="modal-header"/>').appendTo(this.modal);
  $('<button type="button" class="close" data-dismiss="modal"' +
      ' aria-hidden="true">&times</button>').appendTo(modalHeader);
  $('<h3/>').appendTo(modalHeader).text(this.title || '');
}

function _buildModalBody() {
  var modalBody = $('<div class="modal-body"/>').appendTo(this.modal);
  this.form = $('<form class="form-horizontal"/>')
    .appendTo(modalBody).attr('method', this.method).attr('url', this.url);
  addFieldsToForm(this.form, this.fields);
  this.errorBlock = $('<div class="alert alert-error hide">')
    .appendTo(modalBody);
  this.error = $('<span id="error-span"/>').appendTo(this.errorBlock);
}

function _buildModalFooter() {
  var modalFooter = $('<div class="modal-footer"/>').appendTo(this.modal);
  $('<button class="btn", data-dismiss="modal", aria-hidden="true"/>')
    .appendTo(modalFooter).text(this.closeText);
  this.validateButton =
    $('<button class="btn btn-primary"/>').appendTo(modalFooter)
    .text(this.validateText);
}

// Execute Methods

function _create() {
  var self = this;
  loadFields.call(self, function() {
    self.validateButton.on('click', function() {
      var data = retrieveData.call(self);
      if (self.formValidation.call(self, data))
      $.ajax({ type: self.method, url: self.url, data: data })
      .done(self.done.bind(self)).fail(self.fail.bind(self));
    });
    self.modal.modal();
  });
}

function _edit(selectedRowData) {
  var self = this;
  loadFields.call(self, function() {
    setData.call(self, selectedRowData);
    self.validateButton.on('click', function() {
      var data = retrieveData.call(self);
      if (self.formValidation.call(self, data)) {
        if (self.idField && selectedRowData)
      data.id = selectedRowData[self.idField];
    $.ajax({ type: self.method, url: self.url, data: data })
      .done(self.done.bind(self)).fail(self.fail.bind(self));
      }
    });
    self.modal.modal();
  });
}

function _remove(selectedRowsData) {
  var self = this;
  loadFields.call(self, function() {
    self.validateButton.on('click', function() {
      var data = { ids: [] };
      if (self.idField && selectedRowsData)
      for (var index = 0; index < selectedRowsData.length; ++index)
      data.ids.push(selectedRowsData[index][self.idField]);
    $.ajax({ type: self.method, url: self.url, data: data })
      .done(self.done.bind(self)).fail(self.fail.bind(self));
    });
    self.modal.modal();
  });
}

// Request over method

function done() {
  this.modal.modal('hide');
  $(this.domTable).dataTable().fnReloadAjax();
}

function fail(jqXHR) {
  if (jqXHR.status == 403) {
    this.error.text(jqXHR.responseText);
    this.errorBlock.fadeIn();
  } else {
    document.open();
    document.write(jqXHR.responseText);
    document.close();
  }
}

// Field Management

function buildFields(fieldsConfig) {
  var fields = [];
  for (var index = 0; index < fieldsConfig.length; ++index) {
    fields.push(new Field(fieldsConfig[index]));
  }
  return fields;
}

function addFieldsToForm(form, fields) {
  for(var index = 0; index < fields.length; ++index) {
    var field = fields[index];
    if (field) field.component.html.appendTo(form);
  }
}

function loadFields(callback) {
  var index = 0;
  var fields = this.fields;
  (function exec() {
    if (index == fields.length) return callback();
    var field = fields[index++];
    if (field && field.isLoaded() === false) field.load(exec);
    else exec();
  })();
}

function retrieveData() {
  var data = {};
  for (var index = 0; index < this.fields.length; ++index) {
    var field = this.fields[index];
    if (field == undefined || field.type == 'label') continue;
    addToData(data, field.name, field.data);
  }
  return data;
}

function addToData(data, key, value) {
  var obj = data;
  var index = -1;
  while ((index = key.indexOf('.')) != -1) {
    var base = key.substr(0, index);
    key = key.substr(index + 1);
    var element = obj[base];
    if (element == undefined) element = obj[base] = {};
    obj = element;
  }
  obj[key] = value;
}

function setData(data) {
  for (var index = 0; index < this.fields.length; ++index) {
    var field = this.fields[index];
    field && (field.data = data);
  }
}

function clearData() {
  for (var index = 0; index < this.fields.length; ++index) {
    var field = this.fields[index];
    field && field.clear();
  }
}

/*
 * Fields
 */

function Field(config) {
  config = config || {};
  var type = config.fieldType || 'label';
  var label = config.label;
  var name = config.name;
  var options = config.options || {};
  updateOptionsDeprecated(options, config) // TODO remove: deprecated
  var component = buildFieldComponent(type, label, options);
  return {
    get type() { return type; },
    get label() { return label; },
    get name() { return name; },
    get options() { return options; },
    get component() { return component; },
    set data(data) {
      if (this.type == 'label' || this.name == undefined) return;
      var chunk = this.name.split('.'), val = data;
      for (var index = 0; index < chunk.length && val != undefined; ++index) {
        val = val[chunk[index]];
      }
      this.component.setData(val);
    },
    get data() {
      if (this.type == 'label') return;
      return this.component.getData();
    },
    isLoaded: function() {
      return this.component.loaded == undefined ||
        this.component.loaded === true;
    },
    load: function(callback) {
      if (this.component.load) this.component.load(callback);
      else callback();
    },
    clear: function() { this.data = undefined; }
  };
}

function updateOptionsDeprecated(options, config) { // TODO remove: deprecated
  var deprecated = ['type', 'multiple', 'src'];
  deprecated.forEach(function(dep) {
    if (config[dep] != undefined) {
      options[dep] = config[dep];
      console.warn("Field attribute", dep,
        "is deprecated ! Replaced by options."+dep);
    }
  });
}

function buildFieldComponent(type, label, options) {
  var component = { html: $('<div class="control-group"/>') };
  if (type == 'label') {
    buildLabelComponent(component, label);
  } else if (type == 'input') {
    if (options.type == 'text') {
      buildTextComponent(component, label);
    } else if (options.type == 'password') {
      buildPasswordComponent(component, label);
    } else if (options.type == 'checkbox') {
      buildCheckboxComponent(component, label);
    } else if (options.type == 'textarea') {
      buildTextareaComponent(component, label);
    } else if (options.type == 'select') {
      buildSelectComponent(component, label, options);
    } else return console.error("Field input type", options.type, "not managed !");
  } else return console.error("Field type", type, "not managed !");
  return component;
}

function buildLabelComponent(component, label) {
  if (label)
    $('<label class="control-label"/>').text(label)
      .appendTo(component.html);
}

function buildTextComponent(component, label) {
  if (label)
    $('<label class="control-label"/>').text(label)
      .appendTo(component.html);
  var ctl = $('<div class="controls"/>').appendTo(component.html);
  component.input = $('<input type="text"/>').appendTo(ctl);
  component.error = $('<div class="error"/>').appendTo(ctl);
  component.setData = function(data) { this.input.val(data || ""); };
  component.getData = function() { return this.input.val(); }
}

function buildPasswordComponent(component, label) {
  if (label)
    $('<label class="control-label"/>').text(label)
      .appendTo(component.html);
  var ctl = $('<div class="controls"/>').appendTo(component.html);
  component.input = $('<input type="password"/>').appendTo(ctl);
  component.error = $('<div class="error"/>').appendTo(ctl);
  component.setData = function(data) { this.input.val(data || ""); };
  component.getData = function() { return this.input.val(); }
}

function buildCheckboxComponent(component, label) {
  var ctl = $('<div class="controls"/>').appendTo(component.html);
  component.input = $('<input type="checkbox"/>')
    .appendTo($('<label class="checkbox"/>')
        .appendTo(ctl));
    if (label) component.input.after(label);
  component.error = $('<div class="error"/>').appendTo(ctl);
  component.setData = function(data) {
    this.input.prop('checked', data || false);
  };
  component.getData = function() { return this.input.prop('checked'); }
}

function buildTextareaComponent(component, label) {
  if (label)
    $('<label class="control-label"/>').text(label)
      .appendTo(component.html);
  var ctl = $('<div class="controls"/>').appendTo(component.html);
  component.input = $('<textarea/>').appendTo(ctl);
  component.error = $('<div class="error"/>').appendTo(ctl);
  component.setData = function(data) { this.input.val(data || ""); };
  component.getData = function() { return this.input.val(); }
}

function buildSelectComponent(component, label, options) {
  if (label)
    $('<label class="control-label"/>').text(label)
      .appendTo(component.html);
  var ctl = $('<div class="controls"/>').appendTo(component.html);
  component.input = $('<select/>').appendTo(ctl);
  if (options.multiple === true) component.input.attr('multiple', 'multiple');
  else component.input.append('<option/>');
  component.error = $('<div class="error"/>').appendTo(ctl);
  component.setData = function(data) {
    if (data == undefined)
      return this.input.find('option:selected').removeAttr('selected')
    var equals = getEqualsFunction(options);
    this.input.find('option').each(function() {
      for (var index = 0; index < data.length; ++index) {
        if (equals($(this).attr('key'), data[index])) {
          return $(this).attr('selected', 'selected');
        }
      }
      $(this).removeAttr('selected');
    });
  };
  component.getData = function() {
    var data = [];
    this.input.find('option:selected').each(function() {
      data.push($(this).attr('key'));
    });
    return data;
  }
  component.loaded = false;
  component.load = function(callback) {
    if (options.src) {
      loadValues(options.src, function(err, data) {
        if (err) return callback(err);
        setSelectValues(component.input, data);
        component.loaded = true;
        callback();
      });
    } else callback();
  };
}

function getEqualsFunction(options) {
  var equals;
  if (typeof options.equals == 'function') equals = options.equals;
  else if (typeof options.keyField == 'string') {
    equals = function(key, val) { return key == val[options.keyField]; };
  } else {
    equals = function(key, val) { return key == val; };
  }
  return equals;
}

function setSelectValues(select, data) {
  if (!data) return;
  for (var index = 0; index < data.length; ++index) {
    var d = data[index];
    if (d) select.append($('<option/>').attr('key', d.key).text(d.value));
  }
}

function loadValues(src, callback) {
  if (typeof src == 'string') loadAjaxValues(src, callback);
  else if (src == 'function') src(callback);
  else console.error("Load field value unknown source type:", src);
}

function loadAjaxValues(url, callback) {
  $.ajax({ dataType: "json", type: "POST", url: url,
    success: function(data) { callback(null, data); },
    error: function(err) { callback(err); }
  });
}

/*
 * Extend DataTable
 */

$.fn.dataTableExt.oApi.fnReloadAjax = function(oSettings, sNewSource) {
  if (typeof sNewSource != 'undefined') {
    oSettings.sAjaxSource = sNewSource;
  }
  this.fnClearTable(this);
  this.oApi._fnProcessingDisplay(oSettings, true);
  $.getJSON(oSettings.sAjaxSource, null, $.proxy(function(json) {
    for (var i=0 ; i<json.aaData.length ; i++) {
      this.oApi._fnAddData(oSettings, json.aaData[i]);
    }
    oSettings.aiDisplay = oSettings.aiDisplayMaster.slice();
    this.fnDraw(this);
    this.oApi._fnProcessingDisplay(oSettings, false);
  }, this));
}

/*
 * Extend TableTool
 */

TableTools.BUTTONS.new_button =
$.extend(true, "new_button", TableTools.buttonBase, {
  sButtonText: "New",
  sButtonClass: "btn",
  editor: null,
  fnClick: create
});

TableTools.BUTTONS.edit_button =
$.extend(true, "edit_button", TableTools.buttonBase, {
  sButtonText: "Edit",
  sButtonClass: "btn disabled",
  fnSelect: ActifSelectSingle,
  editor: null,
  fnClick: edit
});

TableTools.BUTTONS.remove_button =
$.extend(true, "remove_button", TableTools.buttonBase, {
  sButtonText: "Remove",
  sButtonClass: "btn disabled",
  fnSelect: ActifSelect,
  editor: null,
  fnClick: remove
});

function ActifSelectSingle(button, config, rows) {
  var oneSelected = this.fnGetSelected().length == 1;
  if (oneSelected) $(button).removeClass('disabled');
  else $(button).addClass('disabled');
}

function ActifSelect(button, config, rows) {
  var oneSelected = this.fnGetSelected().length > 0;
  if (oneSelected) $(button).removeClass('disabled');
  else $(button).addClass('disabled');
}

function create(nButton, oConfig, oFlash) {
  if (!$(nButton).hasClass('disabled') && oConfig.editor)
    oConfig.editor.create();
}

function edit(nButton, oConfig, oFlash) {
  if (!$(nButton).hasClass('disabled') && oConfig.editor) {
    var selectedData = this.fnGetSelectedData();
    if (selectedData.length != 1)
      return console.error("Internal Error: edit cannot be called against more or less than 1 row !");
    selectedData = selectedData[0];
    oConfig.editor.edit(selectedData);
  }
}

function remove(nButton, oConfig, oFlash) {
  if (!$(nButton).hasClass('disabled') && oConfig.editor) {
    var selectedData = this.fnGetSelectedData();
    oConfig.editor.remove(selectedData);
  }
}
