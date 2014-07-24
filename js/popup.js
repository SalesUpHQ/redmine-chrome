/**
 * @author zhixin wen <wenzhixin2010@gmail.com>
 */

function Popup() {
    this.$options = $('.options');
    this.$main = $('.main');
    this.$urls = $('#urls');
    this.$roles = $('#roles');
    this.$issues = $('#issues');
    this.$detail = $('.issue-detail');
}

Popup.prototype.init = function () {
    this.initView();
    this.initUrls();
    this.initRoles();
    this.initIssues();
};

Popup.prototype.initView = function () {
    if (!settings('urls').length) {
        return;
    }
    this.$options.hide();
    this.$main.show();
};

Popup.prototype.initUrls = function () {
    var that = this,
        html = [];

    $.each(settings('urls'), function (i, url) {
        html.push(util.sprintf('<option value="%s">%s</option>', i, url));
    });
    if (settings('urls').length > 1) {
        this.$urls.show().html(html.join('')).change(function () {
            settings('url_index', $(this)[0].selectedIndex);
            that.initRoles();
            that.initIssues();
        })[0].selectedIndex = settings('url_index');
    }
};

Popup.prototype.initRoles = function () {
    var that = this,
        html = [];

    $.each(settings('roles'), function (i, role) {
        var data = settings('data')[that.getKey(role)];

        html.push(util.sprintf($('#roleTpl').html(),
            i ,
            locale['roles_' + role],
            data.issues.length,
            data.unreadList.length === 0 ? 'none' : ' ',
            data.unreadList.length
        ));
    });
    if (settings('roles').length > 1) {
        this.$roles.show().html(html.join(''))
            .find('li').click(function() {
                settings('role_index', $(this).index());
                $(this).addClass('active').siblings().removeClass('active');
                that.initIssues();
            }).eq(settings('role_index')).addClass('active');
    }
};

Popup.prototype.initIssues = function () {
    var that = this,
        html = [],
        url = settings('urls')[settings('url_index')],
        data = settings('data')[this.getKey()];

    html.push(util.sprintf($('#markTpl').html(),
        data.unreadList.length ? ' ' : 'none'));

    $.each(data.issues, function (i, issue) {
        html.push(util.sprintf($('#issueTpl').html(),
            $.inArray(util.getIuid(issue), data.unreadList) === -1 ? '' : 'fb',
            i,
            util.getPriorityLabel(issue.priority.name),
            issue.priority.name,
            issue.project.name,
            moment(new Date(issue.updated_on)).format('YYYY-MM-DD HH:mm:ss'),
            moment(new Date(issue.updated_on)).fromNow(),
            url + '/issues/' + issue.id,
            issue.tracker.name,
            issue.id,
            issue.subject
        ));
    });
    this.$issues.scrollTop(0).html(html.join(''))
        .find('.mark-all').off('click').on('click', function () {
            $(this).hide();
            that.$issues.find('.list-group-item').removeClass('fb');
            that.setUnreadCount(0, settings('unread') - data.unreadList.length);
            that.resetUnreadData();
        }).end()
        .find('.list-group-item')
        .off('click').on('click', function () {
            $(this).removeClass('fb');
            that.showIssue(data.issues[$(this).data('index')]);
        });

    util.setLocale(this.$issues);
    that.$issues.find('.copy-issue').off('click').on('click', function (event) {
        event.stopImmediatePropagation();

        var index = $(this).parents('.list-group-item').data('index');
        util.copyText('#' + data.issues[index].id);
    });
    that.$issues.find('[data-toggle="tooltip"]').tooltip({
        placement: 'bottom'
    });
};

Popup.prototype.showIssue = function (issue) {
    var that = this,
        url = settings('urls')[settings('url_index')] + '/issues/' + issue.id;

    this.getIssue(issue, url, function (issue, error) {
        issue = $.extend({}, {
            tracker: {name: ''},
            status: {name: ''},
            priority: {name: ''},
            assigned_to: {name: ''},
            author: {name: ''}
        }, issue);

        that.$main.hide();
        console.log(textile(issue.description));
        that.$detail.show().html(util.sprintf($('#detailTpl').html(),
                url,
                issue.tracker.name,
                issue.id,
                issue.subject,
                issue.status.name,
                issue.priority.name,
                issue.assigned_to.name,
                issue.author.name,
                textile(issue.description)
            ));
        that.$detail.find('.close').off('click').on('click', function () {
            that.$detail.hide();
            that.$main.show();
        });

        util.setLocale(that.$detail);
        that.$detail.find('.copy-issue').off('click').on('click', function () {
            util.copyText('#' + issue.id);
        });
        that.$detail.find('[data-toggle="tooltip"]').tooltip({
            placement: 'bottom'
        });

        if (!error) {
            that.showAttachments(url, issue.description);
            that.showHistories(url);
            that.showEdit(issue, url);
            that.updateUnreadCount(issue);
        }
    });
};

Popup.prototype.getIssue = function (issue, url, callback) {
    $.ajax({
        url: url + '.json',
        timeout: 1000,
        success: function (res) {
            callback(res.issue);
        },
        error: function () {
            callback(issue, true);
        }
    });
};

Popup.prototype.showAttachments = function (url, description) {
    var that = this;

    $.get(url + '.json?include=attachments', function (data) {
        var pattern = /!([^!]+)!/g,
            result = null,
            attachments = data.issue.attachments;

        while ((result = pattern.exec(description)) != null) {
            var imgSrc = util.getContentUrl(result[1], attachments);
            if (imgSrc) {
                var reg = new RegExp(result[0], 'g');
                description = description.replace(reg, util.sprintf('<img src="%s">', imgSrc));
            }
        }
        description = description.replace(/\r\n/g, '<br>');
        that.$detail.find('.desc-detail').html(textile(description));
    });
};

Popup.prototype.showHistories = function (url) {
    var that = this;

    $.get(url, function (res) {
        var $history = $(res).find('#history');

        if (!$history.length) {
            return;
        }
        $history.find('a').each(function () {
            $(this).replaceWith('<span>' + $(this).text() + '</span>');
        });
        that.$detail.find('.history').html($history.html());
    });
};

Popup.prototype.showEdit = function (issue, url) {
    var that = this;

    $.get(url + '/edit', function (res) {
        var $res = $(res),
            $edit = that.$detail.find('.edit').show();

        $.each([
            'issue[status_id]:status.id',
            'issue[done_ratio]:done_ratio',
            'issue[priority_id]:priority.id',
            'issue[assigned_to_id]:assigned_to.id'
        ], function (i, name) {
            var names = name.split(':');

            name = util.sprintf('[name="%s"]', names[0]);
            $edit.find(name).html($res.find(name).html())
                .val(util.getValueByString(issue, names[1]));
        });
        $edit.find('[name="authenticity_token"]')
            .val($res.find('[name="authenticity_token"]').val());

        $edit.off('submit').on('submit', function (event) {
            event.preventDefault();

            $(this).find(':submit').prop('disabled', true);

            $.ajax({
                url: url,
                type: 'POST',
                cache: false,
                contentType: false,
                processData: false,
                data: new FormData($(this)[0]),
                success: function (res) {
                    that.showIssue(issue);
                }
            });
        });
    });
};

Popup.prototype.updateUnreadCount = function (issue) {
    var data = settings('data'),
        curData = data[this.getKey()],
        iuid = util.getIuid(issue),
        index = $.inArray(iuid, curData.unreadList);

    if (index !== -1) {
        curData.unreadList.splice(index, 1);
        this.setUnreadCount(curData.unreadList.length, settings('unread') - 1);

        if (curData.unreadList.length) {
            curData.readList.push(iuid);
            data[this.getKey()] = curData;
            settings('data', data);
        } else {
            this.resetUnreadData();
        }

        // fix #11: hide mark all as read
        if (curData.unreadList.length === 0) {
            this.$issues.find('.mark-all').hide();
        }
    } else if ($.inArray(util.getIuid(issue), curData.readList) === -1) {
        curData.readList.push(iuid);
        data[this.getKey()] = curData;
        settings('data', data);
    }
};

Popup.prototype.setUnreadCount = function (roleCount, count) {
    var $role = this.$roles.find('li').eq(settings('role_index'));

    if (roleCount) {
        $role.find('.label-info').text(roleCount);
    } else {
        $role.find('.label-info').hide();
    }
    settings('unread', count);
    chrome.browserAction.setBadgeText({
        text: count > 0 ? count + '' : ''
    });
};

Popup.prototype.resetUnreadData = function () {
    var data = settings('data');
    data[this.getKey()].lastRead = +new Date();
    data[this.getKey()].unreadList = [];
    data[this.getKey()].readedList = [];
    settings('data', data);
};

Popup.prototype.getKey = function (role) {
    var url = settings('urls')[settings('url_index')];

    role = role || settings('roles')[settings('role_index')];
    return $.md5(url + role);
};

$(function() {
    'use strict';

    moment.lang(settings('language').toLowerCase());

    util.initLocale(function() {
        var popup = new Popup();
        popup.init();
    });
});