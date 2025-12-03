use strict;
use warnings;
use v5.012;

use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

if (!@ARGV) {
	die 'Usage: make_global_skill_meta.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select = $db->prepare(<<SQL
   SELECT s.id, s.group_id, s.icon_id, COALESCE(sp.need_skill_point,0), s.disp_order
     FROM skill_data s
LEFT JOIN single_mode_skill_need_point sp
       ON s.id = sp.id
    WHERE s.is_general_skill = 1 OR s.rarity >= 3;
SQL
);

$select->execute;

my ($id, $group_id, $icon_id, $sp_cost, $disp_order);

$select->bind_columns(\($id, $group_id, $icon_id, $sp_cost, $disp_order));

my $skills = {};
while ($select->fetch) {
	$skills->{$id} = {groupId => "$group_id", iconId => "$icon_id", baseCost => $sp_cost, order => $disp_order};
}

my $json = JSON::PP->new;
$json->canonical(1);
say $json->encode($skills);
